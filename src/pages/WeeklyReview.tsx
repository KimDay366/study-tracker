import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DailyRecord, WeeklyReview as WeeklyReviewEntity } from '@/types';
import { dailyRecordRepo, weeklyReviewRepo } from '@/lib/storage';
import { QUOTES, getRandomQuote } from '@/lib/quotes';
import { useUIStore } from '@/stores/uiStore';
import styles from './WeeklyReview.module.css';

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// ==============================
// 날짜 유틸
// ==============================
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getThisWeekSunday(): string {
  const now = new Date();
  const dow = now.getDay(); // 0=일
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - dow);
  return toYMD(sunday);
}

function addWeeks(weekStartDate: string, delta: number): string {
  const d = new Date(weekStartDate + 'T00:00:00');
  d.setDate(d.getDate() + delta * 7);
  return toYMD(d);
}

function formatWeekRange(weekStartDate: string): string {
  const start = new Date(weekStartDate + 'T00:00:00');
  const end = new Date(weekStartDate + 'T00:00:00');
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  return `${fmt(start)} ~ ${fmt(end)}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = DOW_LABELS[d.getDay()];
  const label = `${m}.${String(day).padStart(2, '0')} (${dow})`;
  return label;
}

function isTodaySunday(): boolean {
  return new Date().getDay() === 0;
}

// ==============================
// 반개 하트 컴포넌트 (clip-path)
// ==============================
interface HeartRowProps {
  achievementPercent: number;
  colorVar?: string; // '--cat-color-XX'
  isRow?: boolean;   // 요약행=true → flex-nowrap
}

function HeartRow({ achievementPercent, colorVar, isRow = false }: HeartRowProps) {
  if (achievementPercent >= 100) {
    return <span className={styles.heartRainbow}>🌈</span>;
  }

  const fullHearts = Math.floor(achievementPercent / 10); // 이분법: 10% 단위
  const emptyHearts = 10 - fullHearts;

  const fgColor = colorVar ? `var(${colorVar})` : 'var(--color-primary)';

  return (
    <span className={isRow ? styles.heartRowContainer : styles.heartRowContainerWrap}>
      {Array.from({ length: fullHearts }, (_, i) => (
        <span key={`f${i}`} className={styles.heartWrap}>
          <span className={styles.heartBg} style={{ color: 'var(--color-border)' }}>♥</span>
          <span className={styles.heartFg} style={{ color: fgColor }}>♥</span>
        </span>
      ))}
      {Array.from({ length: emptyHearts }, (_, i) => (
        <span key={`e${i}`} className={styles.heartWrap}>
          <span className={styles.heartBg} style={{ color: 'var(--color-border)' }}>♥</span>
        </span>
      ))}
    </span>
  );
}

// ==============================
// 주간 날짜 7개 배열 생성
// ==============================
function getWeekDates(weekStartDate: string): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartDate + 'T00:00:00');
    d.setDate(d.getDate() + i);
    dates.push(toYMD(d));
  }
  return dates;
}

// ==============================
// 스코어 아코디언 아이템
// ==============================
interface AccordionItemProps {
  dateStr: string;
  record: DailyRecord | null;
  isToday: boolean;
  isFuture: boolean;
}

function AccordionItem({ dateStr, record, isToday, isFuture }: AccordionItemProps) {
  const [open, setOpen] = useState(false);
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  const isSunday = dow === 0;
  const dateLabel = formatDateLabel(dateStr);

  const totalPct = record?.achievementCache?.totalAchievementPercent ?? null;
  const hasRecord = !!record;
  const logicName = record?.logicSnapshot.name ?? null;

  // 기록 없는 날: 펼쳐도 내용 없음 → 클릭 불필요
  const canToggle = hasRecord;

  // 카테고리별 달성률 계산
  const catPercents: Array<{ id: string; name: string; colorVar: string; pct: number }> = [];
  if (record) {
    const catMinMap = new Map<string, number>();
    record.sessions.forEach(s => {
      catMinMap.set(s.categoryId, (catMinMap.get(s.categoryId) ?? 0) + s.durationMinutes);
    });
    record.logicSnapshot.categories.forEach(cat => {
      const actual = catMinMap.get(cat.id) ?? 0;
      const pct = cat.targetMinutes > 0
        ? Math.round((actual / cat.targetMinutes) * 1000) / 10
        : 0;
      catPercents.push({ id: cat.id, name: cat.name, colorVar: cat.colorVar, pct });
    });
  }

  return (
    <div className={styles.accordionItem}>
      <button
        type="button"
        className={styles.accordionHeader}
        onClick={() => canToggle && setOpen(o => !o)}
        aria-expanded={open}
        disabled={!canToggle}
      >
        <div className={styles.accordionLeft}>
          <span
            className={`${styles.accordionDate} ${isSunday ? styles.accordionDateSun : ''}`}
          >
            {dateLabel}
          </span>
          {isToday && (
            <span className={styles.accordionLogicName} style={{ color: 'var(--color-text-disabled)' }}>
              오늘이에요
            </span>
          )}
          {!isToday && logicName && (
            <span className={styles.accordionLogicName}>{logicName}</span>
          )}
          {!isToday && !hasRecord && !isFuture && (
            <span className={styles.accordionLogicName} style={{ color: 'var(--color-text-disabled)' }}>
              기록 없음
            </span>
          )}
        </div>
        <div className={styles.accordionRight}>
          {totalPct !== null ? (
            <>
              <span className={styles.accordionPct}>{totalPct}%</span>
              <HeartRow achievementPercent={totalPct} colorVar="--color-primary" isRow />
            </>
          ) : (
            <span className={styles.accordionPct} style={{ color: 'var(--color-text-disabled)' }}>—</span>
          )}
          {canToggle && (
            <span className={`${styles.accordionChevron} ${open ? styles.accordionChevronOpen : ''}`}>
              ▼
            </span>
          )}
        </div>
      </button>

      {open && canToggle && (
        <div className={styles.accordionDetail}>
          {catPercents.length === 0 ? (
            <div className={styles.noRecord}>이 날은 공부 기록이 없어요.</div>
          ) : (
            catPercents.map(cat => (
              <div key={cat.id} className={styles.accordionCatRow}>
                <div className={styles.accordionCatLeft}>
                  <span
                    className={styles.accordionCatDot}
                    style={{ background: `var(${cat.colorVar})` }}
                  />
                  <div className={styles.accordionCatNamePct}>
                    <span className={styles.accordionCatName}>{cat.name}</span>
                    <span className={styles.accordionCatPct}>{cat.pct}%</span>
                  </div>
                </div>
                <HeartRow achievementPercent={cat.pct} colorVar={cat.colorVar} />
              </div>
            ))
          )}
          {!hasRecord && (
            <div className={styles.noRecord}>이 날은 공부 기록이 없어요.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ==============================
// 메인 컴포넌트
// ==============================
export function WeeklyReview() {
  const [searchParams] = useSearchParams();
  const showToast = useUIStore(s => s.showToast);

  const thisWeekSunday = getThisWeekSunday();

  // 쿼리스트링으로 주 전달받기 (달력 연동)
  const initialWeek = searchParams.get('week') ?? thisWeekSunday;
  const [weekStartDate, setWeekStartDate] = useState(initialWeek);

  const [keep, setKeep] = useState('');
  const [problem, setProblem] = useState('');
  const [tryText, setTryText] = useState('');
  const [pledge, setPledge] = useState('');
  const [pledgeVisible, setPledgeVisible] = useState(false);
  const [currentQuoteIdx, setCurrentQuoteIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const [saving, setSaving] = useState(false);

  const weekDates = getWeekDates(weekStartDate);
  const todayStr = toYMD(new Date());

  // 해당 주 7일 기록 로드
  const [records, setRecords] = useState<Map<string, DailyRecord>>(() => {
    const map = new Map<string, DailyRecord>();
    weekDates.forEach(d => {
      const r = dailyRecordRepo.getByDate(d);
      if (r) map.set(d, r);
    });
    return map;
  });

  // 기존 회고 로드
  useEffect(() => {
    const existing = weeklyReviewRepo.getByWeekStart(weekStartDate);
    if (existing) {
      setKeep(existing.keep);
      setProblem(existing.problem);
      setTryText(existing.try);
      // 저장된 pledge는 usedBuiltinQuote 여부와 무관하게 항상 복원
      setPledge(existing.pledge);
    } else {
      setKeep('');
      setProblem('');
      setTryText('');
      setPledge('');
    }
    setPledgeVisible(false);
    // 해당 주 기록 갱신
    const map = new Map<string, DailyRecord>();
    const dates = getWeekDates(weekStartDate);
    dates.forEach(d => {
      const r = dailyRecordRepo.getByDate(d);
      if (r) map.set(d, r);
    });
    setRecords(map);
  }, [weekStartDate]);

  const handlePrevWeek = useCallback(() => {
    setWeekStartDate(prev => addWeeks(prev, -1));
  }, []);

  const handleNextWeek = useCallback(() => {
    const next = addWeeks(weekStartDate, 1);
    if (next <= thisWeekSunday) {
      setWeekStartDate(next);
    }
  }, [weekStartDate, thisWeekSunday]);

  const canGoNext = addWeeks(weekStartDate, 1) <= thisWeekSunday;

  const handleRefreshQuote = useCallback(() => {
    setCurrentQuoteIdx(prev => {
      let next = prev;
      if (QUOTES.length > 1) {
        while (next === prev) {
          next = Math.floor(Math.random() * QUOTES.length);
        }
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      let pledgeText: string;
      let usedBuiltinQuote: boolean;
      let builtinQuoteIndex: number | null;

      if (pledge.trim() === '') {
        // 다짐 필드 비어있으면 저장 시점에 랜덤 명언 고정
        const { quote, index } = getRandomQuote();
        pledgeText = quote.text;
        usedBuiltinQuote = true;
        builtinQuoteIndex = index;
      } else {
        pledgeText = pledge.trim();
        usedBuiltinQuote = false;
        builtinQuoteIndex = null;
      }

      const now = new Date().toISOString();
      const existing = weeklyReviewRepo.getByWeekStart(weekStartDate);

      const review: WeeklyReviewEntity = {
        weekStartDate,
        keep,
        problem,
        try: tryText,
        pledge: pledgeText,
        usedBuiltinQuote,
        builtinQuoteIndex,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      weeklyReviewRepo.save(review);
      showToast('회고가 저장됐어요.', 'success');
    } catch (e) {
      const msg = e instanceof Error && e.message === 'QUOTA_EXCEEDED'
        ? '저장 공간이 가득 찼어요. 설정에서 오래된 데이터를 삭제해 주세요.'
        : '저장 중 오류가 발생했어요.';
      showToast(msg, 'danger');
    } finally {
      setSaving(false);
    }
  }, [weekStartDate, keep, problem, tryText, pledge, showToast]);

  const isNotSunday = !isTodaySunday() && weekStartDate === thisWeekSunday;
  const weekRangeLabel = formatWeekRange(weekStartDate);
  const currentQuote = QUOTES[currentQuoteIdx];

  return (
    <div>
      {/* 헤더: 제목 + 주 선택기 */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>주간 회고</h1>
        <div className={styles.weekNav}>
          <button
            type="button"
            className={styles.weekNavBtn}
            onClick={handlePrevWeek}
            aria-label="이전 주"
          >
            ‹
          </button>
          <span className={styles.weekRange}>{weekRangeLabel}</span>
          <button
            type="button"
            className={styles.weekNavBtn}
            onClick={handleNextWeek}
            disabled={!canGoNext}
            aria-label="다음 주"
          >
            ›
          </button>
        </div>
      </div>

      {/* 일요일 안내 배너 */}
      {isNotSunday && (
        <div className={styles.infoBanner}>
          <span>📅</span>
          <span>일요일에 회고를 작성하면 한 주를 더 잘 마무리할 수 있어요!</span>
        </div>
      )}

      {/* 2열 그리드 */}
      <div className={styles.reviewGrid}>

        {/* 왼쪽: 이번 주 스코어 */}
        <div>
          <div className={styles.sectionCard} style={{ marginBottom: 0 }}>
            <div className={styles.sectionCardHeader}>이번 주 스코어</div>
            {weekDates.map(dateStr => {
              const record = records.get(dateStr) ?? null;
              const isToday = dateStr === todayStr;
              const isFuture = dateStr > todayStr;
              return (
                <AccordionItem
                  key={dateStr}
                  dateStr={dateStr}
                  record={record}
                  isToday={isToday}
                  isFuture={isFuture}
                />
              );
            })}
          </div>
        </div>

        {/* 오른쪽: KPT 회고 + 저장 */}
        <div>
          <div className={styles.sectionCard}>
            <div className={styles.sectionCardHeader}>KPT 회고</div>
            <div className={styles.sectionCardBody}>
              <div className={styles.kptSection}>

                {/* Keep */}
                <div>
                  <div className={styles.kptLabel}>
                    <span className={`${styles.kptBadge} ${styles.kptBadgeK}`}>K</span>
                    Keep — 계속 유지할 것
                  </div>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    value={keep}
                    onChange={e => setKeep(e.target.value)}
                    placeholder="이번 주에 잘한 것, 계속하고 싶은 습관을 적어 보세요."
                  />
                </div>

                {/* Problem */}
                <div>
                  <div className={styles.kptLabel}>
                    <span className={`${styles.kptBadge} ${styles.kptBadgeP}`}>P</span>
                    Problem — 문제였던 것
                  </div>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    value={problem}
                    onChange={e => setProblem(e.target.value)}
                    placeholder="이번 주에 잘 안 됐거나 개선이 필요한 점을 적어 보세요."
                  />
                </div>

                {/* Try + [한줄다짐 보기] 버튼 */}
                <div>
                  <div className={styles.kptLabelRow}>
                    <div className={styles.kptLabelLeft}>
                      <span className={`${styles.kptBadge} ${styles.kptBadgeT}`}>T</span>
                      Try — 다음 주에 시도할 것
                    </div>
                    <button
                      type="button"
                      className={styles.btnPledgeTrigger}
                      onClick={() => setPledgeVisible(v => !v)}
                    >
                      ✨ 한줄다짐 보기
                    </button>
                  </div>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    value={tryText}
                    onChange={e => setTryText(e.target.value)}
                    placeholder="다음 주에 새롭게 시도하거나 개선할 방법을 적어 보세요."
                  />

                  {/* 한줄다짐 입력 필드 */}
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    maxLength={200}
                    value={pledge}
                    onChange={e => setPledge(e.target.value)}
                    placeholder="이번 주 나만의 한 줄 다짐을 적어 보세요."
                    style={{ marginTop: 'var(--space-2)' }}
                  />

                  {/* 명언 카드 */}
                  {pledgeVisible && (
                    <div className={styles.quoteCard}>
                      <div className={styles.quoteCardLabel}>
                        <span>✨</span>
                        오늘의 다짐 명언
                      </div>
                      <div className={styles.quoteText}>
                        "{currentQuote.text}"
                      </div>
                      <div className={styles.quoteSource}>— {currentQuote.source}</div>
                      <div className={styles.quoteActions}>
                        <button
                          type="button"
                          className={styles.btnQuoteRefresh}
                          onClick={handleRefreshQuote}
                        >
                          다른 명언 보기
                        </button>
                        <button
                          type="button"
                          className={styles.btnQuoteRefresh}
                          onClick={() => setPledge(currentQuote.text)}
                        >
                          이 문장으로 저장
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* 저장 버튼 */}
          <button
            type="button"
            className={styles.btnSave}
            onClick={handleSave}
            disabled={saving}
          >
            회고 저장하기
          </button>
        </div>

      </div>
    </div>
  );
}

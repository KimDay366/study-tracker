import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { DailyRecord } from '@/types';
import { useWeekRecords } from '@/hooks/query/useDailyRecords';
import { useWeeklyReview, useUpsertWeeklyReview } from '@/hooks/query/useWeeklyReviews';
import { getApiErrorCode } from '@/lib/api/errorCode';
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

function getThisWeekMonday(): string {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // 0=월 (월요일 시작 주)
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);
  return toYMD(monday);
}

function addWeeks(weekStartDate: string, delta: number): string {
  const d = new Date(weekStartDate + 'T00:00:00');
  d.setDate(d.getDate() + delta * 7);
  return toYMD(d);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
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
  /** 다중 플랜 대응: 그 날짜의 플랜 그룹 배열(빈 배열 = 기록 없음). 주간 스코어는 그룹들을 합산해 보여준다. */
  records: DailyRecord[];
  isToday: boolean;
  isFuture: boolean;
}

function AccordionItem({ dateStr, records, isToday, isFuture }: AccordionItemProps) {
  const [open, setOpen] = useState(false);
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  const isSunday = dow === 0;
  const dateLabel = formatDateLabel(dateStr);

  const hasRecord = records.length > 0;
  const multiGroup = records.length > 1;

  // 총 달성률 — 같은 날짜의 여러 플랜 그룹을 SUM(누적 공부시간 / 누적 목표시간)해 하루 전체 스코어로 보여준다.
  const totalMinutes = records.reduce(
    (sum, r) => sum + r.sessions.reduce((s, sess) => s + sess.durationMinutes, 0), 0,
  );
  const totalTarget = records.reduce((sum, r) => sum + r.logicSnapshot.totalTargetMinutes, 0);
  const totalPct = hasRecord
    ? (totalTarget > 0 ? Math.round((totalMinutes / totalTarget) * 1000) / 10 : 0)
    : null;
  // 오늘 플랜이 여럿이면 이름을 함께 표시(예: "수능 D-100 · 내신 대비")
  const logicName = hasRecord ? records.map(r => r.logicSnapshot.name ?? '[삭제된 플랜]').join(' · ') : null;

  // 기록 없는 날: 펼쳐도 내용 없음 → 클릭 불필요
  const canToggle = hasRecord;

  // 활동별 달성률 계산 — 그룹이 여럿이면 활동 이름 앞에 플랜명을 붙여 구분한다.
  const catPercents: Array<{ id: string; name: string; colorVar: string; pct: number }> = [];
  records.forEach(record => {
    const catMinMap = new Map<string, number>();
    record.sessions.forEach(s => {
      catMinMap.set(s.categoryId, (catMinMap.get(s.categoryId) ?? 0) + s.durationMinutes);
    });
    record.logicSnapshot.categories.forEach(cat => {
      const actual = catMinMap.get(cat.id) ?? 0;
      const pct = cat.targetMinutes > 0
        ? Math.round((actual / cat.targetMinutes) * 1000) / 10
        : 0;
      const name = multiGroup ? `[${record.logicSnapshot.name}] ${cat.name}` : cat.name;
      catPercents.push({ id: cat.id, name, colorVar: cat.colorVar, pct });
    });
  });

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
            <div className={styles.noRecord}>이 날은 기록이 없어요.</div>
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
            <div className={styles.noRecord}>이 날은 기록이 없어요.</div>
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
  const navigate = useNavigate();
  const showToast = useUIStore(s => s.showToast);

  const thisWeekMonday = getThisWeekMonday();

  // 쿼리스트링으로 주 전달받기 (달력 연동)
  const initialWeek = searchParams.get('week') ?? thisWeekMonday;
  const [weekStartDate, setWeekStartDate] = useState(initialWeek);
  // 뒤로가기 시 돌아갈 달력 월 (달력에서 넘어올 때 from=YYYY-MM 로 전달)
  const fromMonth = searchParams.get('from');

  // 등록/수정 여부: 이미 저장된 정리는 기본 '열람(잠금)' 상태, [수정] 버튼으로만 편집
  const [editMode, setEditMode] = useState(false);

  const [keep, setKeep] = useState('');
  const [problem, setProblem] = useState('');
  const [tryText, setTryText] = useState('');
  // pledge: 입력 UI는 제거됐지만 DB 필드 유지를 위해 기존 저장값을 상태로 보존한다.
  const [pledge, setPledge] = useState('');
  const [saving, setSaving] = useState(false);

  const weekDates = useMemo(() => getWeekDates(weekStartDate), [weekStartDate]);
  const todayStr = toYMD(new Date());

  // 등록·수정 가능 기간: 그 주 '일요일'(월+6) ~ +30일. 미래엔 미개시, 그 후엔 마감.
  const weekSunday = addDays(weekStartDate, 6);
  const editDeadline = addDays(weekSunday, 30);
  const isFutureWeek = todayStr < weekSunday;
  const isExpired = todayStr > editDeadline;
  const canEdit = !isFutureWeek && !isExpired;

  // 해당 주 7일 기록 (서버 조회, 달력/타이머와 캐시 공유)
  // 다중 플랜 대응: 하루에 플랜 그룹이 여럿일 수 있으므로 날짜별로 배열을 보관한다.
  const recordQueries = useWeekRecords(weekDates);
  const records = new Map<string, DailyRecord[]>();
  recordQueries.forEach((q, i) => {
    records.set(weekDates[i], q.data ?? []);
  });

  // 기존 주간 정리 로드 (서버)
  const { data: existingReview } = useWeeklyReview(weekStartDate);
  useEffect(() => {
    if (existingReview === undefined) return; // 로딩 중엔 현재 입력 유지
    setKeep(existingReview?.keep ?? '');
    setProblem(existingReview?.problem ?? '');
    setTryText(existingReview?.try ?? '');
    // 저장된 pledge는 UI엔 안 보이지만 재저장 시 유실되지 않도록 상태로 복원
    setPledge(existingReview?.pledge ?? '');
    // 이미 저장된 주는 잠금(열람), 미저장이면서 기간 내면 바로 작성 모드로 시작
    const wkSun = addDays(weekStartDate, 6);
    const editable = todayStr >= wkSun && todayStr <= addDays(wkSun, 30);
    setEditMode(existingReview ? false : editable);
    // todayStr은 하루 단위 상수라 의존성에서 제외
  }, [existingReview, weekStartDate]);

  const handlePrevWeek = useCallback(() => {
    setWeekStartDate(prev => addWeeks(prev, -1));
  }, []);

  const handleNextWeek = useCallback(() => {
    const next = addWeeks(weekStartDate, 1);
    if (next <= thisWeekMonday) {
      setWeekStartDate(next);
    }
  }, [weekStartDate, thisWeekMonday]);

  const canGoNext = addWeeks(weekStartDate, 1) <= thisWeekMonday;

  const upsertMutation = useUpsertWeeklyReview();

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await upsertMutation.mutateAsync({
        weekStartDate,
        body: {
          keep,
          problem,
          try: tryText,
          // 다짐 입력 UI는 제거됐지만 DB 필드는 유지 — 기존 저장값/메타를 그대로 보존
          pledge,
          usedBuiltinQuote: existingReview?.usedBuiltinQuote ?? false,
          builtinQuoteIndex: existingReview?.builtinQuoteIndex ?? null,
        },
      });
      showToast('주간 정리가 저장됐어요.', 'success');
      setEditMode(false); // 저장 후 잠금(열람) 상태로 전환
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === 'WEEKLY_REVIEW_NOT_OPEN') {
        showToast('아직 이 주의 정리를 작성할 수 없어요.', 'danger');
      } else if (code === 'WEEKLY_REVIEW_WINDOW_CLOSED') {
        showToast('작성·수정 기간이 지났어요. (일요일부터 30일까지)', 'danger');
      } else {
        showToast('저장 중 오류가 발생했어요.', 'danger');
      }
    } finally {
      setSaving(false);
    }
  }, [weekStartDate, keep, problem, tryText, pledge, existingReview, showToast, upsertMutation]);

  const weekRangeLabel = formatWeekRange(weekStartDate);

  return (
    <div>
      {/* 앱바: 뒤로 아이콘 + 제목 + 주 선택기 (플랜 만들기와 동일 레이아웃) */}
      <header className={styles.appBar}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate(`/calendar?ym=${fromMonth ?? weekStartDate.slice(0, 7)}`)}
          aria-label="달력으로 뒤로 가기"
        >
          ←
        </button>
        <span className={styles.appBarTitle}>주간 정리</span>
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
      </header>

      {/* 상태 배너 — 미래(미개시) / 마감(열람만) 안내 */}
      {isFutureWeek && (
        <div className={styles.infoBanner}>
          <span>🔒</span>
          <span>아직 이 주의 정리를 작성할 수 없어요. 이 주 일요일부터 작성할 수 있어요.</span>
        </div>
      )}
      {isExpired && (
        <div className={styles.infoBanner}>
          <span>⏳</span>
          <span>작성·수정 기간이 지났어요. (해당 주 일요일로부터 30일까지) 지금은 열람만 가능해요.</span>
        </div>
      )}

      {/* 2열 그리드 */}
      <div className={styles.reviewGrid}>

        {/* 왼쪽: 이번 주 스코어 */}
        <div>
          <div className={styles.sectionCard} style={{ marginBottom: 0 }}>
            <div className={styles.sectionCardHeader}>이번 주 스코어</div>
            {weekDates.map(dateStr => {
              const dayRecords = records.get(dateStr) ?? [];
              const isToday = dateStr === todayStr;
              const isFuture = dateStr > todayStr;
              return (
                <AccordionItem
                  key={dateStr}
                  dateStr={dateStr}
                  records={dayRecords}
                  isToday={isToday}
                  isFuture={isFuture}
                />
              );
            })}
          </div>
        </div>

        {/* 오른쪽: KPT 정리 + 저장 */}
        <div>
          <div className={styles.sectionCard}>
            <div
              className={styles.sectionCardHeader}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span>KPT 정리</span>
              {existingReview && !editMode && canEdit && (
                <button type="button" className={styles.btnEdit} onClick={() => setEditMode(true)}>
                  ✎ 수정
                </button>
              )}
            </div>
            <div className={styles.sectionCardBody}>
              <div className={styles.kptSection}>

                {/* Keep */}
                <div>
                  <div className={styles.kptLabel}>
                    <span className={`${styles.kptBadge} ${styles.kptBadgeK}`}>K</span>
                    Keep — 계속 유지할 것
                  </div>
                  <textarea
                    className={`${styles.textarea} ${!editMode ? styles.textareaLocked : ''}`}
                    rows={3}
                    value={keep}
                    onChange={e => setKeep(e.target.value)}
                    readOnly={!editMode}
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
                    className={`${styles.textarea} ${!editMode ? styles.textareaLocked : ''}`}
                    rows={3}
                    value={problem}
                    onChange={e => setProblem(e.target.value)}
                    readOnly={!editMode}
                    placeholder="이번 주에 잘 안 됐거나 개선이 필요한 점을 적어 보세요."
                  />
                </div>

                {/* Try */}
                <div>
                  <div className={styles.kptLabel}>
                    <span className={`${styles.kptBadge} ${styles.kptBadgeT}`}>T</span>
                    Try — 다음 주에 시도할 것
                  </div>
                  <textarea
                    className={`${styles.textarea} ${!editMode ? styles.textareaLocked : ''}`}
                    rows={3}
                    value={tryText}
                    onChange={e => setTryText(e.target.value)}
                    readOnly={!editMode}
                    placeholder="다음 주에 새롭게 시도하거나 개선할 방법을 적어 보세요."
                  />
                </div>

              </div>
            </div>
          </div>

          {/* 저장 버튼 — 편집 모드(작성/수정)일 때만 */}
          {editMode && (
            <button
              type="button"
              className={styles.btnSave}
              onClick={handleSave}
              disabled={saving || !canEdit}
            >
              {existingReview ? '수정 저장하기' : '주간 정리 저장하기'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

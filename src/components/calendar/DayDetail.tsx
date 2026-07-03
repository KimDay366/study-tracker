import { useState } from 'react';
import type { CalendarDayInfo } from '@/hooks/useCalendarMonth';
import { formatTimestamp } from '@/hooks/useCalendarMonth';
import type { Session } from '@/types';
import { HeartDisplay } from '@/components/common/HeartDisplay';
import styles from './DayDetail.module.css';

interface Props {
  date: string | null; // YYYY-MM-DD, null이면 placeholder
  info: CalendarDayInfo | null;
  today: string; // YYYY-MM-DD
  // 오늘 날짜에만 전달. 없으면 읽기 전용
  onEditSession?: (sess: Session) => void;
  onDeleteSession?: (sess: Session) => void;
  onAddSession?: () => void;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${DAY_NAMES[d.getDay()]}요일`;
}

function isFutureDate(dateStr: string, today: string): boolean {
  return dateStr > today;
}

export function DayDetail({ date, info, today, onEditSession, onDeleteSession, onAddSession }: Props) {
  const [openSessions, setOpenSessions] = useState<Set<string>>(new Set());

  if (!date) {
    return <div className={styles.placeholder}>날짜를 선택하면 상세 내용이 표시돼요.</div>;
  }

  const isToday = date === today;
  const isFuture = isFutureDate(date, today);
  const dateLabel = formatDateLabel(date);

  function toggleSession(catId: string) {
    setOpenSessions((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  // 기록 없음 / 미래 분기
  if (!info || !info.record) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerRow}>
            <span className={styles.dateTitle}>{dateLabel}</span>
            {isToday && <span className={styles.todayBadge}>✏ 오늘</span>}
          </div>
        </div>
        <div className={styles.emptyState}>
          {isFuture ? '아직 기록이 없어요.' : '이 날은 공부 기록이 없어요.'}
        </div>
      </div>
    );
  }

  const record = info.record;
  const snap = record.logicSnapshot;
  const { totalAchievementPercent, rainbowHeart, rainbowStar, categoryPercents } = info;

  return (
    <div className={styles.panel}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <span className={styles.dateTitle}>{dateLabel}</span>
          {isToday && <span className={styles.todayBadge}>✏ 오늘</span>}
        </div>
        <span className={styles.logicName}>{snap.name ?? '[삭제된 로직]'}</span>
      </div>

      {/* ① 전체 달성률 */}
      <div className={styles.summaryBlock}>
        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>전체 달성률</span>
          <span className={styles.totalPct}>{totalAchievementPercent.toFixed(1)}%</span>
        </div>
        <div className={styles.hearts}>
          <HeartDisplay
            achievementPercent={totalAchievementPercent}
            colorVar="--color-primary"
            rainbow={rainbowHeart}
            size={10}
          />
        </div>

        {/* ② 무지개 배지 */}
        {(rainbowHeart || rainbowStar) && (
          <div className={styles.rainbowBadgesRow}>
            {rainbowHeart && (
              <span className={styles.rainbowBadgeChip}>
                <span className={styles.chipIcon}>♥</span>
                <span className={styles.chipText}>전체 달성 100%</span>
              </span>
            )}
            {rainbowStar && (
              <span className={styles.rainbowBadgeChip}>
                <span className={styles.chipIcon}>★</span>
                <span className={styles.chipText}>전체 카테고리 달성 100%</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ③ 카테고리별 달성률 카드 */}
      <div className={styles.categoryList}>
        {snap.categories.map((cat, idx) => {
          const catPct = categoryPercents[idx] ?? 0;
          const isOver = catPct > 100;
          const catSessions = record.sessions.filter((s) => s.categoryId === cat.id);
          const actualMinutes = catSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
          const isOpen = openSessions.has(cat.id);

          return (
            <div key={cat.id} className={styles.catCard}>
              <div className={styles.catCardMain}>
                <div className={styles.catCardTop}>
                  <div className={styles.catCardLeft}>
                    <span
                      className={styles.catDot}
                      style={{ background: `var(${cat.colorVar})` }}
                    />
                    <span className={styles.catName}>{cat.name}</span>
                    {isOver && <span className={styles.overachieve}>초과 달성!</span>}
                  </div>
                  <span className={styles.catPct}>{catPct.toFixed(1)}%</span>
                </div>
                <span className={styles.catTime}>
                  목표 {cat.targetMinutes}분 · 실제 {actualMinutes}분
                </span>
                <HeartDisplay
                  achievementPercent={catPct}
                  colorVar={cat.colorVar}
                  size={10}
                />
              </div>

              {/* [+ 내역] 토글 */}
              {catSessions.length > 0 && (
                <div className={styles.catCardFooter}>
                  <button
                    type="button"
                    className={`${styles.sessionToggleBtn} ${isOpen ? styles.open : ''}`}
                    onClick={() => toggleSession(cat.id)}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? '▲ 내역 닫기' : '+ 내역'}
                  </button>
                </div>
              )}

              {/* 세션 내역 패널 */}
              {isOpen && (
                <div className={styles.sessionPanel}>
                  {catSessions.map((sess) => (
                    <div key={sess.id} className={styles.sessionItem}>
                      <span
                        className={styles.sessionDot}
                        style={{ background: `var(${cat.colorVar})` }}
                      />
                      <span className={styles.sessionTime}>
                        {formatTimestamp(sess.sessionStartTimestamp)} ~{' '}
                        {formatTimestamp(sess.sessionEndTimestamp)}
                      </span>
                      <span className={styles.sessionDur}>{sess.durationMinutes}분</span>
                      {isToday && onEditSession && onDeleteSession && (
                        <>
                          <button
                            type="button"
                            className={styles.sessionActionBtn}
                            onClick={() => onEditSession(sess)}
                            aria-label="세션 수정"
                          >✏️</button>
                          <button
                            type="button"
                            className={`${styles.sessionActionBtn} ${styles.sessionDeleteBtn}`}
                            onClick={() => onDeleteSession(sess)}
                            aria-label="세션 삭제"
                          >🗑️</button>
                        </>
                      )}
                    </div>
                  ))}
                  {/* 같은 카테고리 2회 이상: 합계 표기 */}
                  {catSessions.length >= 2 && (
                    <div className={styles.sessionSubtotal}>
                      <span className={styles.subtotalLabel}>{cat.name} 합계</span>
                      <span className={styles.subtotalDur}>{actualMinutes}분</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* 오늘만: 세션 직접 추가 버튼 */}
        {isToday && onAddSession && (
          <button type="button" className={styles.addSessionBtn} onClick={onAddSession}>
            + 세션 직접 추가
          </button>
        )}
      </div>
    </div>
  );
}

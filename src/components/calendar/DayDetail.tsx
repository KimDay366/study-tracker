import { useState } from 'react';
import type { CalendarDayInfo } from '@/hooks/useCalendarMonth';
import { formatTimestamp } from '@/hooks/useCalendarMonth';
import { capAveragePercent } from '@/lib/calculator/achievement';
import type { Session } from '@/types';
import { HeartDisplay } from '@/components/common/HeartDisplay';
import styles from './DayDetail.module.css';

interface Props {
  date: string | null; // YYYY-MM-DD, null이면 placeholder
  info: CalendarDayInfo | null;
  today: string; // YYYY-MM-DD
  // 편집 가능한 날짜(이번 주, 오늘 포함)에만 전달. 없으면 읽기 전용
  onEditSession?: (sess: Session) => void;
  onDeleteSession?: (sess: Session) => void;
  onAddSession?: () => void;
  /** 지금 "기록 직접 추가"를 누르면 어느 플랜에 들어가는지 — 아직 안 골랐으면 null */
  addLogicName?: string | null;
  /** 플랜이 여러 개일 때만 전달 — 이미 고른 플랜을 바꾸고 싶을 때 플랜 선택 화면을 다시 연다 */
  onChangeAddLogic?: () => void;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${DAY_NAMES[d.getDay()]}요일`;
}

function isFutureDate(dateStr: string, today: string): boolean {
  return dateStr > today;
}

export function DayDetail({
  date, info, today, onEditSession, onDeleteSession, onAddSession, addLogicName, onChangeAddLogic,
}: Props) {
  const [openSessions, setOpenSessions] = useState<Set<string>>(new Set());

  if (!date) {
    return <div className={styles.placeholder}>날짜를 선택하면 상세 내용이 표시돼요.</div>;
  }

  const isToday = date === today;
  const isFuture = isFutureDate(date, today);
  const dateLabel = formatDateLabel(date);
  const groups = info?.groups ?? [];

  // 총 달성률 — 그날 플랜들을 "각 100%로 캡한 뒤 평균"한다(실제분/목표분 합산이 아님).
  // 합산 방식이면 초과 달성 플랜(예: 120%)의 초과분이 미달 플랜을 상쇄해 부풀려지므로,
  // 플랜별 "플랜 달성률"(그룹 totalAchievementPercent, 120% 등 캡 없이 그대로)과 달리 여기서만 캡-평균을 쓴다.
  const dayAchievementPercent = capAveragePercent(groups.map((g) => g.totalAchievementPercent));

  // 토글 상태 key는 그룹(플랜) + 활동으로 구성 — 하루에 플랜이 여럿이어도 서로 독립적으로 열고 닫힌다.
  function toggleSession(key: string) {
    setOpenSessions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className={styles.panel}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <span className={styles.dateTitle}>{dateLabel}</span>
          {isToday && <span className={styles.todayBadge}>✏ 오늘</span>}
        </div>
        {/* 총 달성률 — 그날 기록된 모든 플랜을 합산한 하루 종합 달성률 (플랜별 "플랜 달성률"과는 별개) */}
        {groups.length > 0 && (
          <div className={styles.dayTotalRow}>
            <span className={styles.dayTotalLabel}>총 달성률</span>
            <span className={styles.dayTotalPct}>{dayAchievementPercent.toFixed(1)}%</span>
          </div>
        )}
      </div>

      {/* 기록 없음 / 미래 분기 */}
      {groups.length === 0 ? (
        <div className={styles.emptyState}>
          {isFuture ? '아직 기록이 없어요.' : '이 날은 기록이 없어요.'}
        </div>
      ) : (
        // 플랜 그룹마다 섹션 반복 렌더링 (다중 플랜 대응) — 그룹별로 달성률·뱃지·활동 카드를 독립적으로 표시
        groups.map((group) => {
          const record = group.record;
          const snap = record.logicSnapshot;
          const { totalAchievementPercent, rainbowHeart, rainbowStar, categoryPercents } = group;
          const groupKey = `${record.logicId}:${record.createdAt}`;

          return (
            <div key={groupKey} className={styles.groupSection}>
              <div className={styles.groupHeader}>
                <span className={styles.groupHeaderTitle}>{snap.name ?? '[삭제된 플랜]'}</span>
              </div>

              {/* ① 플랜 달성률 (이 플랜 그룹 하나만의 달성률 — 하루 종합인 "총 달성률"과는 다름) */}
              <div className={styles.summaryBlock}>
                <div className={styles.totalRow}>
                  <span className={styles.totalLabel}>플랜 달성률</span>
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
                        <span className={styles.chipText}>전체 활동 달성 100%</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* ③ 활동별 달성률 카드 */}
              <div className={styles.categoryList}>
                {snap.categories.map((cat, idx) => {
                  const catPct = categoryPercents[idx] ?? 0;
                  const isOver = catPct > 100;
                  const catSessions = record.sessions.filter((s) => s.categoryId === cat.id);
                  const actualMinutes = catSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
                  const sessionKey = `${groupKey}:${cat.id}`;
                  const isOpen = openSessions.has(sessionKey);

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
                            onClick={() => toggleSession(sessionKey)}
                            aria-expanded={isOpen}
                          >
                            {isOpen ? '기록 닫기' : '기록 보기'}
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
                              {onEditSession && onDeleteSession && (
                                <>
                                  <button
                                    type="button"
                                    className={styles.sessionActionBtn}
                                    onClick={() => onEditSession(sess)}
                                    aria-label="기록 수정"
                                  >✏️</button>
                                  <button
                                    type="button"
                                    className={`${styles.sessionActionBtn} ${styles.sessionDeleteBtn}`}
                                    onClick={() => onDeleteSession(sess)}
                                    aria-label="기록 삭제"
                                  >🗑️</button>
                                </>
                              )}
                            </div>
                          ))}
                          {/* 같은 활동 2회 이상: 합계 표기 */}
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
              </div>
            </div>
          );
        })
      )}

      {/* 이번 주 편집 가능한 날짜(오늘 포함)만: 기록 직접 추가 — 어느 플랜에 추가되는지 항상 명확히 보여준다 */}
      {onAddSession && (
        <div className={styles.addLogicSection}>
          {addLogicName && (
            <div className={styles.addLogicRow}>
              <span className={styles.addLogicText}>
                추가 대상 플랜: <strong>{addLogicName}</strong>
              </span>
              {onChangeAddLogic && (
                <button
                  type="button"
                  className={styles.addLogicChangeBtn}
                  onClick={onChangeAddLogic}
                >
                  변경
                </button>
              )}
            </div>
          )}
          <button type="button" className={styles.addSessionBtn} onClick={onAddSession}>
            + 기록 직접 추가
          </button>
        </div>
      )}
    </div>
  );
}

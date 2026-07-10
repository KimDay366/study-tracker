import { useNavigate } from 'react-router-dom';
import type { CalendarCell } from '@/hooks/useCalendarMonth';
import { formatMinutes } from '@/hooks/useCalendarMonth';
import styles from './CalendarGrid.module.css';

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']; // 월요일 시작
const MAX_DOTS = 3;

interface Props {
  year: number;
  month: number;
  cells: CalendarCell[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onMonthChange: (delta: -1 | 1) => void;
}

interface CellWithReview extends CalendarCell {
  weeklyReviewDone?: boolean;
}

export function CalendarGrid({
  year,
  month,
  cells,
  selectedDate,
  onSelectDate,
  onMonthChange,
}: Props) {
  const navigate = useNavigate();
  return (
    <div>
      {/* 월 네비게이션 */}
      <div className={styles.monthNav}>
        <button
          type="button"
          className={styles.monthNavBtn}
          onClick={() => onMonthChange(-1)}
          aria-label="이전 달"
        >
          ‹
        </button>
        <h2 className={styles.monthTitle}>
          {year}년 {month}월
        </h2>
        <button
          type="button"
          className={styles.monthNavBtn}
          onClick={() => onMonthChange(1)}
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className={styles.dayHeaders} role="row">
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`${styles.dayHeader} ${i === 6 ? styles.dayHeaderSun : ''} ${i === 5 ? styles.dayHeaderSat : ''}`}
            role="columnheader"
          >
            {label}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className={styles.calendarGrid} role="grid">
        {cells.map((cell) => {
          const { date, dayOfMonth, isCurrentMonth, isToday, isSunday, isSaturday, info } = cell;
          const cellExt = cell as CellWithReview;
          // 주간 정리는 "그 주(월~일)의 월요일" 날짜를 키로 사용 — 일요일 셀 자신의 날짜가 아니다.
          const reviewWeekDate = cell.weekStartDate ?? date;
          const isSelected = date === selectedDate;
          const hasRecord = !!info;

          // 활동 도트 (최대 3개 + 초과 수) — 그 날의 모든 플랜 그룹을 합쳐 세션이 있는 활동만
          const catDots = hasRecord
            ? info.groups.flatMap((g) =>
                g.record.logicSnapshot.categories
                  .filter((cat) => g.record.sessions.some((s) => s.categoryId === cat.id))
                  .map((cat) => ({ key: `${g.record.logicId}:${cat.id}`, colorVar: cat.colorVar })),
              )
            : [];
          const visibleDots = catDots.slice(0, MAX_DOTS);
          const extraDots = catDots.length - MAX_DOTS;

          // 무지개 하트 — 플랜 하나 달성(전체 달성률 100%)할 때마다 1개씩 누적
          const heartCount = hasRecord ? info.groups.filter((g) => g.rainbowHeart).length : 0;
          // 무지개 별 — 그날의 플랜을 "모두" 달성했을 때만 딱 1개(누적 아님, 날짜 단위 판정)
          const allAchieved = hasRecord && info.allLogicsAchieved;

          // 날짜 숫자 색상 결정 (우선순위: otherMonth > today/selected > sun/sat > default)
          function getDateClassName(): string {
            const classes = [styles.cellDate];
            if (!isCurrentMonth) classes.push(styles.cellDateOtherMonth);
            else if (isToday || isSelected) classes.push(styles.cellDateToday);
            else if (isSunday) classes.push(styles.cellDateSun);
            else if (isSaturday) classes.push(styles.cellDateSat);
            return classes.join(' ');
          }

          function getCellClassName(): string {
            const classes = [styles.cell];
            if (!isCurrentMonth) classes.push(styles.cellOtherMonth);
            if (isToday) classes.push(styles.cellToday);
            if (isSelected) classes.push(styles.cellSelected);
            return classes.join(' ');
          }

          return (
            <div
              key={date}
              className={getCellClassName()}
              role="gridcell"
              aria-label={`${dayOfMonth}일${hasRecord ? `, 기록 ${formatMinutes(info.totalMinutes)}` : ''}`}
              aria-selected={isSelected}
              tabIndex={0}
              onClick={() => onSelectDate(date)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectDate(date);
                }
              }}
            >
              {/* 날짜 숫자 */}
              <div className={styles.cellDateRow}>
                <span className={getDateClassName()}>{dayOfMonth}</span>
              </div>

              {/* 무지개 마커 — 모든 뷰포트 동일: 날짜 숫자 아래, 아이콘 그대로 나열(♥♥♥★). 압축 표기 없음 */}
              {hasRecord && (heartCount > 0 || allAchieved) && (
                <div className={styles.cellMarkers}>
                  {Array.from({ length: heartCount }, (_, i) => (
                    <span key={`h${i}`} className={styles.rainbowMarker} aria-hidden="true">♥</span>
                  ))}
                  {allAchieved && (
                    <span className={styles.rainbowMarker} aria-hidden="true">★</span>
                  )}
                  <span className={styles.srOnly}>
                    {heartCount > 0 ? `달성한 플랜 ${heartCount}개, 무지개 하트. ` : ''}
                    {allAchieved ? `오늘 플랜 ${info.groups.length}개 모두 달성, 무지개 별.` : ''}
                  </span>
                </div>
              )}

              {/* 활동 도트 */}
              {visibleDots.length > 0 && (
                <div className={styles.cellDots}>
                  {visibleDots.map((dot) => (
                    <span
                      key={dot.key}
                      className={styles.cellDot}
                      style={{ background: `var(${dot.colorVar})` }}
                    />
                  ))}
                  {extraDots > 0 && (
                    <span className={styles.cellDotExtra}>+{extraDots}</span>
                  )}
                </div>
              )}

              {/* 총 기록 시간 */}
              {hasRecord && info.totalMinutes > 0 && (
                <span className={styles.cellTime}>{formatMinutes(info.totalMinutes)}</span>
              )}

              {/* 일요일 — 주간 정리 마커 */}
              {isSunday && (
                <div className={styles.weeklyReviewMarker}>
                  {cellExt.weeklyReviewDone ? (
                    <button
                      type="button"
                      className={styles.reviewBtnDone}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/weekly-review?week=${reviewWeekDate}`);
                      }}
                      aria-label="주간 정리 보기"
                    >
                      ✓ 회고
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.reviewBtnEmpty}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/weekly-review?week=${reviewWeekDate}`);
                      }}
                      aria-label="주간 정리 작성하기"
                    >
                      + 회고
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import type { CalendarCell } from '@/hooks/useCalendarMonth';
import { formatMinutes } from '@/hooks/useCalendarMonth';
import styles from './CalendarGrid.module.css';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
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
            className={`${styles.dayHeader} ${i === 0 ? styles.dayHeaderSun : ''} ${i === 6 ? styles.dayHeaderSat : ''}`}
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
          const isSelected = date === selectedDate;
          const hasRecord = !!info;

          // 카테고리 도트 (최대 3개 + 초과 수)
          const catDots = hasRecord
            ? (info.record?.logicSnapshot.categories ?? []).filter((cat) => {
                const sessions = info.record?.sessions.filter((s) => s.categoryId === cat.id) ?? [];
                return sessions.length > 0;
              })
            : [];
          const visibleDots = catDots.slice(0, MAX_DOTS);
          const extraDots = catDots.length - MAX_DOTS;

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
              aria-label={`${dayOfMonth}일${hasRecord ? `, 공부 ${formatMinutes(info.totalMinutes)}` : ''}`}
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
              {/* 날짜 숫자 + 무지개 마커 */}
              <div className={styles.cellDateRow}>
                <span className={getDateClassName()}>{dayOfMonth}</span>
                {hasRecord && (info.rainbowHeart || info.rainbowStar) && (
                  <div className={styles.cellMarkers}>
                    {info.rainbowHeart && (
                      <span
                        className={styles.rainbowMarker}
                        title="전체 달성 100%! 무지개 하트"
                      >
                        ♥
                      </span>
                    )}
                    {info.rainbowStar && (
                      <span
                        className={styles.rainbowMarker}
                        title="모든 카테고리 100%! 무지개 별"
                      >
                        ★
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 카테고리 도트 */}
              {visibleDots.length > 0 && (
                <div className={styles.cellDots}>
                  {visibleDots.map((cat) => (
                    <span
                      key={cat.id}
                      className={styles.cellDot}
                      style={{ background: `var(${cat.colorVar})` }}
                    />
                  ))}
                  {extraDots > 0 && (
                    <span className={styles.cellDotExtra}>+{extraDots}</span>
                  )}
                </div>
              )}

              {/* 총 공부시간 */}
              {hasRecord && info.totalMinutes > 0 && (
                <span className={styles.cellTime}>{formatMinutes(info.totalMinutes)}</span>
              )}

              {/* 일요일 — 주간 회고 마커 */}
              {isSunday && (
                <div className={styles.weeklyReviewMarker}>
                  {cellExt.weeklyReviewDone ? (
                    <button
                      type="button"
                      className={styles.reviewBtnDone}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/weekly-review?week=${date}`);
                      }}
                      aria-label="주간 회고 보기"
                    >
                      ✓ 회고
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.reviewBtnEmpty}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/weekly-review?week=${date}`);
                      }}
                      aria-label="주간 회고 작성하기"
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

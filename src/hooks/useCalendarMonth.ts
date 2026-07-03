import { useMemo } from 'react';
import type { DailyRecord, Session } from '@/types';
import { calcAchievementPercent } from '@/lib/calculator/achievement';

export interface CalendarDayInfo {
  date: string; // YYYY-MM-DD
  record: DailyRecord | null;
  totalMinutes: number;
  totalAchievementPercent: number;
  /** 카테고리별 달성률 (index = logicSnapshot.categories 순서) */
  categoryPercents: number[];
  /** 무지개 하트: 전체 달성 >= 100% */
  rainbowHeart: boolean;
  /** 무지개 별: 모든 카테고리 >= 100% */
  rainbowStar: boolean;
  /** 주간 회고 작성 여부 (일요일 셀 전용, undefined = 일요일 아님) */
  weeklyReviewDone?: boolean;
}

export interface UseCalendarMonthResult {
  /** year/month 기준 달력에 표시될 모든 셀 (이전달·다음달 패딩 포함) */
  calendarCells: CalendarCell[];
  /** 해당 월의 날짜→데이터 맵 */
  dayInfoMap: Map<string, CalendarDayInfo>;
  /** 이번 달 통계 */
  monthStats: { totalMinutes: number; totalTarget: number; achievementPercent: number };
}

export interface CalendarCell {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSunday: boolean;
  isSaturday: boolean;
  info: CalendarDayInfo | null;
  /** 일요일인 경우 해당 주 시작 주간 회고 weekStartDate */
  weekStartDate?: string;
}

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 해당 월의 달력 셀과 날짜별 집계 정보를 반환하는 hook.
 * 데이터는 호출부(서버 쿼리)에서 recordMap으로 주입받는다. recordMap이 바뀌면 재계산.
 * (세션 추가·수정·삭제 후 React Query 무효화 → 새 recordMap → 즉시 반영)
 * 일요일 주간 회고 완료 여부도 호출부에서 서버 조회해 weeklyReviewDoneDates(Set)로 주입한다.
 */
export function useCalendarMonth(
  year: number,
  month: number,
  recordMap: Map<string, DailyRecord>,
  weeklyReviewDoneDates?: Set<string>,
): UseCalendarMonthResult {
  return useMemo(() => {
    const today = toYMD(new Date());

    // 날짜별 집계
    const dayInfoMap = new Map<string, CalendarDayInfo>();
    recordMap.forEach((record, date) => {
      const cache = record.achievementCache;
      let totalMinutes = 0;
      let totalAchievementPercent = 0;
      let categoryPercents: number[] = [];

      if (cache) {
        totalAchievementPercent = cache.totalAchievementPercent;
        categoryPercents = record.logicSnapshot.categories.map((cat) => {
          const found = cache.categoryAchievements.find((ca) => ca.categoryId === cat.id);
          return found?.achievementPercent ?? 0;
        });
        totalMinutes = record.sessions.reduce((s, sess) => s + sess.durationMinutes, 0);
      } else {
        // cache 없으면 실시간 계산
        totalMinutes = record.sessions.reduce((s, sess) => s + sess.durationMinutes, 0);
        totalAchievementPercent = calcAchievementPercent(
          totalMinutes,
          record.logicSnapshot.totalTargetMinutes,
        );
        const catMinMap = new Map<string, number>();
        record.sessions.forEach((s: Session) => {
          catMinMap.set(s.categoryId, (catMinMap.get(s.categoryId) ?? 0) + s.durationMinutes);
        });
        categoryPercents = record.logicSnapshot.categories.map((cat) =>
          calcAchievementPercent(catMinMap.get(cat.id) ?? 0, cat.targetMinutes),
        );
      }

      const rainbowHeart = totalAchievementPercent >= 100;
      const rainbowStar =
        categoryPercents.length > 0 && categoryPercents.every((p) => p >= 100);

      dayInfoMap.set(date, {
        date,
        record,
        totalMinutes,
        totalAchievementPercent,
        categoryPercents,
        rainbowHeart,
        rainbowStar,
      });
    });

    // 달력 셀 생성
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startOffset = firstDay.getDay(); // 0=일
    const totalDays = lastDay.getDate();
    const totalCells = Math.ceil((startOffset + totalDays) / 7) * 7;

    const cells: CalendarCell[] = [];
    for (let i = 0; i < totalCells; i++) {
      const cellDate = new Date(year, month - 1, 1 - startOffset + i);
      const dateStr = toYMD(cellDate);
      const dow = cellDate.getDay();
      const isCurrentMonth = cellDate.getMonth() === month - 1;
      const isSunday = dow === 0;
      const isSaturday = dow === 6;

      let weekStartDate: string | undefined;
      if (isSunday) {
        weekStartDate = dateStr;
      }

      const info = dayInfoMap.get(dateStr) ?? null;

      // 일요일 주간 회고 여부 (호출부에서 주입된 서버 데이터)
      if (isSunday) {
        const reviewDone = weeklyReviewDoneDates?.has(dateStr) ?? false;
        if (info) {
          info.weeklyReviewDone = reviewDone;
        }
        // info 없어도 reviewDone 정보가 필요하므로 빈 info 생성
        const cellWithReview: CalendarCell = {
          date: dateStr,
          dayOfMonth: cellDate.getDate(),
          isCurrentMonth,
          isToday: dateStr === today,
          isSunday,
          isSaturday,
          info,
          weekStartDate,
        };
        // 회고 여부를 cell에도 보관 (일요일 전용)
        (cellWithReview as CalendarCell & { weeklyReviewDone?: boolean }).weeklyReviewDone =
          reviewDone;
        cells.push(cellWithReview);
        continue;
      }

      cells.push({
        date: dateStr,
        dayOfMonth: cellDate.getDate(),
        isCurrentMonth,
        isToday: dateStr === today,
        isSunday,
        isSaturday,
        info,
        weekStartDate,
      });
    }

    // 월별 통계
    let monthTotalMinutes = 0;
    let monthTotalTarget = 0;
    dayInfoMap.forEach((info) => {
      monthTotalMinutes += info.totalMinutes;
      monthTotalTarget += info.record?.logicSnapshot.totalTargetMinutes ?? 0;
    });
    const monthAchievementPercent = monthTotalTarget > 0
      ? Math.round((monthTotalMinutes / monthTotalTarget) * 1000) / 10
      : 0;

    return {
      calendarCells: cells,
      dayInfoMap,
      monthStats: {
        totalMinutes: monthTotalMinutes,
        totalTarget: monthTotalTarget,
        achievementPercent: monthAchievementPercent,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, recordMap]);
}

/** 분 → "Xh Ym" 표기 */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** ms 타임스탬프 → "HH:MM" */
export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

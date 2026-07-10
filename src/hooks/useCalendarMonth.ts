import { useMemo } from 'react';
import type { DailyRecord, Session } from '@/types';
import { calcAchievementPercent, capAveragePercent } from '@/lib/calculator/achievement';

/**
 * 하루 안의 플랜 그룹 하나(=daily_records 한 행)에 대한 집계.
 * 달성률/무지개 뱃지는 항상 이 그룹 스코프 안에서만 계산된다(그룹 간 합산 없음, §8-1 정책).
 */
export interface CalendarGroupInfo {
  record: DailyRecord;
  totalMinutes: number;
  totalAchievementPercent: number;
  /** 활동별 달성률 (index = logicSnapshot.categories 순서) */
  categoryPercents: number[];
  /** 무지개 하트: 이 그룹(플랜) 하나의 전체 달성 >= 100% — 달력 셀 하트 배지 카운트(플랜 달성 개수)에 사용 */
  rainbowHeart: boolean;
  /** 이 그룹의 모든 활동 >= 100% (DayDetail 그룹 요약 배지 전용 — 달력 셀의 무지개 별과는 무관.
   *  무지개 별은 날짜 단위 판정으로 대체됐다 → CalendarDayInfo.allLogicsAchieved 참고) */
  rainbowStar: boolean;
}

export interface CalendarDayInfo {
  date: string; // YYYY-MM-DD
  /** 그 날짜의 플랜 그룹들 (하루에 플랜을 여러 번 바꾸면 여러 개) */
  groups: CalendarGroupInfo[];
  /** 그룹들의 공부 시간 합계 (셀 표시·월 통계용. 달성률 판정에는 쓰지 않음) */
  totalMinutes: number;
  /** 무지개 별: 그날 존재하는 플랜 그룹이 하나 이상이고, 그 그룹 전부가 달성(rainbowHeart)일 때만 true.
   *  플랜별 누적이 아니라 "그날의 플랜을 모두 달성"했을 때 딱 1개만 켜지는 날짜 단위 판정. */
  allLogicsAchieved: boolean;
  /** 주간 정리 작성 여부 (일요일 셀 전용, undefined = 일요일 아님) */
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
  /** 일요일(주 마지막 칸)인 경우 해당 주(월~일) 시작일(월요일) — 주간 정리 weekStartDate */
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
 * 일요일 주간 정리 완료 여부도 호출부에서 서버 조회해 weeklyReviewDoneDates(Set)로 주입한다.
 */
export function useCalendarMonth(
  year: number,
  month: number,
  recordMap: Map<string, DailyRecord[]>,
  weeklyReviewDoneDates?: Set<string>,
): UseCalendarMonthResult {
  return useMemo(() => {
    const today = toYMD(new Date());

    // 하나의 플랜 그룹(레코드)에 대한 집계 — 그룹 스코프 안에서만 계산(그룹 간 합산 없음)
    function calcGroupInfo(record: DailyRecord): CalendarGroupInfo {
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

      return { record, totalMinutes, totalAchievementPercent, categoryPercents, rainbowHeart, rainbowStar };
    }

    // 날짜별 집계 — 같은 날짜에 플랜 그룹이 여럿이면 그룹별로 각각 계산해 배열로 보관
    const dayInfoMap = new Map<string, CalendarDayInfo>();
    recordMap.forEach((records, date) => {
      // 세션(기록)이 있는 플랜만 달력에 표시 — 세션 0개 잔존 그룹이 스테일
      // 캐시로 넘어와도 노출되지 않게 방어(백엔드 조회 필터와 이중 안전장치)
      const groups = records.filter((r) => r.sessions.length > 0).map(calcGroupInfo);
      const totalMinutes = groups.reduce((sum, g) => sum + g.totalMinutes, 0);
      // 무지개 별(신규 규칙): 그날 플랜이 하나 이상 있고, 전부 달성(rainbowHeart)일 때만 true.
      const allLogicsAchieved = groups.length > 0 && groups.every((g) => g.rainbowHeart);

      dayInfoMap.set(date, {
        date,
        groups,
        totalMinutes,
        allLogicsAchieved,
      });
    });

    // 달력 셀 생성 (월요일 시작 — 한 행 = 월~일 한 주)
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // 월=0 … 일=6 기준 오프셋
    const totalDays = lastDay.getDate();
    const totalCells = Math.ceil((startOffset + totalDays) / 7) * 7;

    let currentWeekMonday = ''; // 현재 순회 중인 행(주)의 월요일 날짜 — i%7===0일 때 갱신
    const cells: CalendarCell[] = [];
    for (let i = 0; i < totalCells; i++) {
      const cellDate = new Date(year, month - 1, 1 - startOffset + i);
      const dateStr = toYMD(cellDate);
      const dow = cellDate.getDay();
      const isCurrentMonth = cellDate.getMonth() === month - 1;
      const isSunday = dow === 0;
      const isSaturday = dow === 6;

      if (i % 7 === 0) {
        currentWeekMonday = dateStr;
      }

      let weekStartDate: string | undefined;
      if (isSunday) {
        weekStartDate = currentWeekMonday;
      }

      const info = dayInfoMap.get(dateStr) ?? null;

      // 일요일(그 주 마지막 칸) 기준 주간 정리 여부 — 주 시작(월요일) 날짜로 조회 (호출부에서 주입된 서버 데이터)
      if (isSunday) {
        const reviewDone = weeklyReviewDoneDates?.has(currentWeekMonday) ?? false;
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

    // 월별 통계 — totalMinutes/totalTarget은 표시용("N분/N분") 단순 합계로 그대로 유지.
    // achievementPercent는 날짜 "총 달성률"과 동일하게 그 달 모든 그룹을 각 100%로 캡한 뒤 평균한다
    // (합산 방식이면 초과 달성 플랜이 미달 플랜을 상쇄해 부풀려지므로).
    let monthTotalMinutes = 0;
    let monthTotalTarget = 0;
    const monthGroupPercents: number[] = [];
    dayInfoMap.forEach((info) => {
      monthTotalMinutes += info.totalMinutes;
      info.groups.forEach((g) => {
        monthTotalTarget += g.record.logicSnapshot.totalTargetMinutes;
        monthGroupPercents.push(g.totalAchievementPercent);
      });
    });
    const monthAchievementPercent = capAveragePercent(monthGroupPercents);

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

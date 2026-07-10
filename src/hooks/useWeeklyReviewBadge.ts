import { useWeeklyReview } from '@/hooks/query/useWeeklyReviews';
import { getLocalDateString } from '@/lib/calculator/timer';

/** 이번 주(로컬 기준) 일요일 날짜 문자열 */
function getThisWeekSunday(): string {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay()); // 0=일
  return getLocalDateString(sunday.getTime());
}

/**
 * 일요일이면서 이번 주 회고가 아직 저장되지 않은 경우 true.
 * 내비게이션의 "주간 정리" 항목에 작성 유도 배지를 노출하는 데 사용한다.
 * (React Query가 창 포커스 시 자동 재조회 → 회고 저장 후 배지 자동 해제)
 */
export function useWeeklyReviewBadge(): boolean {
  const isSunday = new Date().getDay() === 0;
  // 일요일이 아니면 빈 문자열 → 쿼리 비활성(enabled:false)
  const { data } = useWeeklyReview(isSunday ? getThisWeekSunday() : '');
  // 일요일이고 이번 주 회고가 없으면(null) 배지 노출
  return isSunday && data === null;
}

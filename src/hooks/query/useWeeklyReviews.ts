import { useMemo } from 'react';
import {
  useQuery, useQueries, useMutation, useQueryClient,
} from '@tanstack/react-query';
import {
  fetchWeeklyReview, upsertWeeklyReview, type WeeklyReviewUpsertInput,
} from '@/api/weekly-reviews';

export const WEEKLY_REVIEWS_KEY = ['weekly-reviews'] as const;

/**
 * 여러 주(일요일 날짜)의 회고 작성 완료 여부를 Set으로 반환. (달력 일요일 셀 배지용)
 * queryKey를 useWeeklyReview와 공유해 캐시 일관성 유지.
 */
export function useWeeklyReviewsDone(weekStartDates: string[]): Set<string> {
  const results = useQueries({
    queries: weekStartDates.map(date => ({
      queryKey: [...WEEKLY_REVIEWS_KEY, date],
      queryFn: () => fetchWeeklyReview(date),
      enabled: !!date,
    })),
  });
  // 데이터 존재(작성 완료)한 날짜만 Set에 담음. 데이터 기반 useMemo로 참조 안정화.
  const doneKey = results.map((r, i) => (r.data ? weekStartDates[i] : '')).join(',');
  return useMemo(() => {
    const set = new Set<string>();
    doneKey.split(',').forEach(d => { if (d) set.add(d); });
    return set;
  }, [doneKey]);
}

/** 단일 주(일요일 시작) 회고 조회. 미존재 시 null. */
export function useWeeklyReview(weekStartDate: string) {
  return useQuery({
    queryKey: [...WEEKLY_REVIEWS_KEY, weekStartDate],
    queryFn: () => fetchWeeklyReview(weekStartDate),
    enabled: !!weekStartDate,
  });
}

/** 주간 회고 저장(upsert). 성공 시 해당 주 캐시를 갱신. */
export function useUpsertWeeklyReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ weekStartDate, body }: { weekStartDate: string; body: WeeklyReviewUpsertInput }) =>
      upsertWeeklyReview(weekStartDate, body),
    onSuccess: (data, { weekStartDate }) => {
      qc.setQueryData([...WEEKLY_REVIEWS_KEY, weekStartDate], data);
    },
  });
}

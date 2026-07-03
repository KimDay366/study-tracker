import {
  useQuery, useMutation, useQueryClient, keepPreviousData,
} from '@tanstack/react-query';
import {
  fetchMonthlyRecords, fetchDailyRecord,
  addSession, updateSession, deleteSession,
  type SessionAddInput, type SessionUpdateInput,
} from '@/api/daily-records';

export const DAILY_RECORDS_KEY = ['daily-records'] as const;

/** 월간 기록 조회. queryKey에 year/month 포함 → 월 전환 시 자동 재조회. 이전 달 데이터 유지로 깜빡임 방지. */
export function useMonthlyRecords(year: number, month: number) {
  return useQuery({
    queryKey: [...DAILY_RECORDS_KEY, 'month', year, month],
    queryFn: () => fetchMonthlyRecords(year, month),
    placeholderData: keepPreviousData,
  });
}

/** 단일 날짜 기록 조회 (오늘 레코드 등). 미존재 시 null. */
export function useDailyRecord(date: string) {
  return useQuery({
    queryKey: [...DAILY_RECORDS_KEY, 'date', date],
    queryFn: () => fetchDailyRecord(date),
    enabled: !!date,
  });
}

/**
 * 세션 변경 후 월간/단일 쿼리를 모두 무효화.
 * 서버가 achievementCache를 실시간 계산하고 뮤테이션 응답은 단일 세션만 주므로,
 * 재조회(invalidate)로만 달력 집계·DayDetail이 정확히 갱신된다.
 * (기존 calRefreshKey 수동 bump를 대체)
 */
function useInvalidateRecords() {
  const qc = useQueryClient();
  return (date: string) => {
    qc.invalidateQueries({ queryKey: [...DAILY_RECORDS_KEY, 'month'] });
    qc.invalidateQueries({ queryKey: [...DAILY_RECORDS_KEY, 'date', date] });
  };
}

export function useAddSession() {
  const invalidate = useInvalidateRecords();
  return useMutation({
    mutationFn: ({ date, body }: { date: string; body: SessionAddInput }) => addSession(date, body),
    onSuccess: (_session, { date }) => invalidate(date),
  });
}

export function useUpdateSession() {
  const invalidate = useInvalidateRecords();
  return useMutation({
    mutationFn: ({ date, sessionId, body }: { date: string; sessionId: string; body: SessionUpdateInput }) =>
      updateSession(date, sessionId, body),
    onSuccess: (_session, { date }) => invalidate(date),
  });
}

export function useDeleteSession() {
  const invalidate = useInvalidateRecords();
  return useMutation({
    mutationFn: ({ date, sessionId }: { date: string; sessionId: string }) =>
      deleteSession(date, sessionId),
    onSuccess: (_void, { date }) => invalidate(date),
  });
}

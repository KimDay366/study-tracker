/**
 * 계정 세션 격리 유틸리티
 *
 * 로그인/로그아웃/미인증 부팅 시 호출.
 * st_ 접두사 로컬 데이터와 Zustand 스토어를 초기화해 계정 간 데이터 오염을 방지한다.
 * TodayStudy·Calendar·WeeklyReview는 3단계 서버 이관 전까지 localStorage 사용 중이므로
 * 세션이 바뀌면 빈 상태에서 시작하도록 의도적으로 비운다.
 */

import type { QueryClient } from '@tanstack/react-query';
import { useTimerStore } from '@/stores/timerStore';
import { useTodayStore } from '@/stores/todayStore';

const ST_PREFIX = 'st_';

/** localStorage + sessionStorage 에서 st_ 키를 모두 제거한다. */
function clearStStorage(): void {
  // localStorage: st_로 시작하는 모든 키 제거 (동적 키 st_daily_*, st_weekly_* 포함)
  const lsKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(ST_PREFIX)) lsKeys.push(key);
  }
  lsKeys.forEach((k) => localStorage.removeItem(k));

  // sessionStorage: st_ 키 제거 (st_session_draft)
  const ssKeys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(ST_PREFIX)) ssKeys.push(key);
  }
  ssKeys.forEach((k) => sessionStorage.removeItem(k));
}

/** Zustand 스토어를 초기 상태로 리셋한다. */
function resetStores(): void {
  useTimerStore.getState().resetTimer();
  useTodayStore.getState().reset();
}

/**
 * 로그인/로그아웃/미인증 부팅 공통 초기화.
 * storage 비우기 → store 리셋 순서를 보장한다.
 */
export function clearLocalData(): void {
  clearStStorage();
  resetStores();
}

/**
 * 세션 전환 3종 세트: storage + store + React Query 캐시를 한 번에 초기화한다.
 *
 * A→B 계정 전환 시 staleTime 내 React Query 캐시에 이전 계정 데이터가 남는 문제를 방지.
 * queryClient는 순환참조를 피하기 위해 인자로 주입받는다.
 *
 * 사용 지점: 로그인 성공(Login.tsx), 로그아웃(Settings.tsx), 미인증 부팅(AuthGuard.tsx)
 */
export function clearSessionAndCache(queryClient: QueryClient): void {
  clearLocalData();
  queryClient.clear();
}

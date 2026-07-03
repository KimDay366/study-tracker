/**
 * clearSessionAndCache 유닛 테스트
 *
 * 계정 A 로그인 → 데이터 캐시 → 로그아웃 → 계정 B 로그인 시
 * React Query 캐시(queryClient)가 반드시 비워지는지 검증.
 *
 * Major-2 회귀 방지: 로그인(Login.tsx) / 로그아웃(Settings.tsx) / 미인증부팅(AuthGuard.tsx)
 * 세 경로 모두 clearSessionAndCache를 호출해야 한다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

// --- localStorage / sessionStorage mock ---
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    _store: () => store,
  };
})();

const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    _store: () => store,
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock, writable: true });

// Zustand store mock
const mockResetTimer = vi.fn();
const mockReset = vi.fn();

vi.mock('@/stores/timerStore', () => ({
  useTimerStore: { getState: () => ({ resetTimer: mockResetTimer }) },
}));

vi.mock('@/stores/todayStore', () => ({
  useTodayStore: { getState: () => ({ reset: mockReset }) },
}));

import { clearSessionAndCache } from '@/lib/storage/clearLocalData';

beforeEach(() => {
  localStorageMock.clear();
  sessionStorageMock.clear();
  vi.clearAllMocks();
});

describe('clearSessionAndCache — 계정 격리 3종 세트', () => {
  it('queryClient.clear()를 호출해 React Query 캐시를 비운다', () => {
    const qc = new QueryClient();
    // 캐시에 A 계정 데이터를 직접 심는다
    qc.setQueryData(['settings'], { nickname: '계정A', firstLaunchDate: '2026-01-01' });
    qc.setQueryData(['logics'], [{ id: '1', name: '로직1' }]);

    expect(qc.getQueryCache().getAll()).toHaveLength(2);

    clearSessionAndCache(qc);

    expect(qc.getQueryCache().getAll()).toHaveLength(0);
  });

  it('st_ localStorage 키를 함께 제거한다', () => {
    const qc = new QueryClient();
    localStorageMock.setItem('st_daily_2026-06-20', '{}');
    localStorageMock.setItem('st_routine', '{}');
    localStorageMock.setItem('other', 'keep');

    clearSessionAndCache(qc);

    const remaining = localStorageMock._store();
    expect(Object.keys(remaining).filter(k => k.startsWith('st_'))).toHaveLength(0);
    expect(remaining['other']).toBe('keep');
  });

  it('Zustand timerStore.resetTimer()와 todayStore.reset()을 호출한다', () => {
    const qc = new QueryClient();

    clearSessionAndCache(qc);

    expect(mockResetTimer).toHaveBeenCalledOnce();
    expect(mockReset).toHaveBeenCalledOnce();
  });

  it('A→B 계정 전환 시나리오: 로그인 후 캐시가 남지 않는다', () => {
    const qc = new QueryClient();

    // 1단계: 계정 A 로그인 후 React Query가 데이터를 캐시함
    qc.setQueryData(['settings'], { nickname: '계정A' });
    qc.setQueryData(['routines'], [{ id: 'r1' }]);
    localStorageMock.setItem('st_daily_2026-06-22', JSON.stringify({ studyTime: 3600 }));

    // 2단계: 계정 A 로그아웃 — clearSessionAndCache 호출
    clearSessionAndCache(qc);

    // 3단계: 계정 B 로그인 직전 상태 검증 — 캐시가 비어 있어야 함
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
    expect(Object.keys(localStorageMock._store()).filter(k => k.startsWith('st_'))).toHaveLength(0);
  });
});

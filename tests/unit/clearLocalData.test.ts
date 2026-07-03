/**
 * clearLocalData 유닛 테스트
 *
 * 로그인/로그아웃/미인증 부팅 시 st_ 데이터가 깨끗하게 비워지는지 검증.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- localStorage mock ---
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

// --- sessionStorage mock ---
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

// store mock — vi.fn()으로 교체한 뒤 모듈이 로드될 때 같은 참조를 공유하도록 설정
const mockResetTimer = vi.fn();
const mockReset = vi.fn();

vi.mock('@/stores/timerStore', () => ({
  useTimerStore: {
    getState: () => ({ resetTimer: mockResetTimer }),
  },
}));

vi.mock('@/stores/todayStore', () => ({
  useTodayStore: {
    getState: () => ({ reset: mockReset }),
  },
}));

import { clearLocalData } from '@/lib/storage/clearLocalData';

beforeEach(() => {
  localStorageMock.clear();
  sessionStorageMock.clear();
  vi.clearAllMocks();
});

describe('clearLocalData', () => {
  it('st_ 접두사 localStorage 키를 모두 제거한다', () => {
    localStorageMock.setItem('st_logics', '[]');
    localStorageMock.setItem('st_routine', '{}');
    localStorageMock.setItem('st_settings', '{}');
    localStorageMock.setItem('st_daily_2026-06-22', '{}');
    localStorageMock.setItem('st_weekly_2026-06-01', '{}');
    localStorageMock.setItem('st_today_ui', '{}');
    // st_ 아닌 키는 남아야 함
    localStorageMock.setItem('other_key', 'should-remain');

    clearLocalData();

    const remaining = localStorageMock._store();
    expect(Object.keys(remaining).filter(k => k.startsWith('st_'))).toHaveLength(0);
    expect(remaining['other_key']).toBe('should-remain');
  });

  it('st_ 접두사 sessionStorage 키(st_session_draft)를 제거한다', () => {
    sessionStorageMock.setItem('st_session_draft', '{"categoryId":"c1"}');
    sessionStorageMock.setItem('unrelated', 'keep');

    clearLocalData();

    const remaining = sessionStorageMock._store();
    expect(remaining['st_session_draft']).toBeUndefined();
    expect(remaining['unrelated']).toBe('keep');
  });

  it('localStorage가 비어 있어도 에러 없이 통과한다', () => {
    expect(() => clearLocalData()).not.toThrow();
  });

  it('동적 키(st_daily_*, st_weekly_*) 다수를 모두 제거한다', () => {
    for (let d = 1; d <= 5; d++) {
      localStorageMock.setItem(`st_daily_2026-06-0${d}`, '{}');
      localStorageMock.setItem(`st_weekly_2026-06-0${d}`, '{}');
    }

    clearLocalData();

    const remaining = Object.keys(localStorageMock._store());
    expect(remaining.filter(k => k.startsWith('st_'))).toHaveLength(0);
  });

  it('Zustand timerStore.resetTimer()를 호출한다', () => {
    clearLocalData();
    expect(mockResetTimer).toHaveBeenCalledOnce();
  });

  it('Zustand todayStore.reset()를 호출한다', () => {
    clearLocalData();
    expect(mockReset).toHaveBeenCalledOnce();
  });
});

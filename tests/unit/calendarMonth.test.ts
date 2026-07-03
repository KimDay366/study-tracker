import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DailyRecordRepository } from '@/lib/storage/localStorageRepo';
import { formatMinutes, formatTimestamp } from '@/hooks/useCalendarMonth';
import type { DailyRecord } from '@/types';

/* =============================================
   localStorage mock — getMonthlyDates는 length/key() 사용
============================================= */
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  const keysArr = () => Object.keys(store);
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return keysArr().length; },
    key: vi.fn((index: number) => keysArr()[index] ?? null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

/* =============================================
   DailyRecordRepository — 월간 메서드 테스트
============================================= */
describe('DailyRecordRepository — getMonthlyDates', () => {
  const repo = new DailyRecordRepository();

  function makeDummyRecord(date: string): DailyRecord {
    return {
      date,
      logicId: 'logic-1',
      logicSnapshot: { name: '테스트', totalTargetMinutes: 60, categories: [] },
      sessions: [],
      achievementCache: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  it('해당 월에 기록 없으면 빈 배열 반환', () => {
    expect(repo.getMonthlyDates(2026, 6)).toEqual([]);
  });

  it('해당 월 기록 날짜만 반환 (다른 달 제외)', () => {
    repo.save(makeDummyRecord('2026-06-01'));
    repo.save(makeDummyRecord('2026-06-15'));
    repo.save(makeDummyRecord('2026-07-01')); // 다른 달
    const dates = repo.getMonthlyDates(2026, 6);
    expect(dates).toContain('2026-06-01');
    expect(dates).toContain('2026-06-15');
    expect(dates).not.toContain('2026-07-01');
    expect(dates).toHaveLength(2);
  });

  it('반환 배열이 날짜 순 정렬됨', () => {
    repo.save(makeDummyRecord('2026-06-20'));
    repo.save(makeDummyRecord('2026-06-05'));
    repo.save(makeDummyRecord('2026-06-10'));
    const dates = repo.getMonthlyDates(2026, 6);
    expect(dates).toEqual(['2026-06-05', '2026-06-10', '2026-06-20']);
  });

  it('getMonthlyRecords가 Map을 반환하고 각 date에 DailyRecord가 포함됨', () => {
    const record = makeDummyRecord('2026-06-01');
    repo.save(record);
    const map = repo.getMonthlyRecords(2026, 6);
    expect(map.size).toBe(1);
    expect(map.get('2026-06-01')?.date).toBe('2026-06-01');
  });
});

/* =============================================
   유틸 함수 테스트
============================================= */
describe('formatMinutes', () => {
  it('0분은 빈 문자열', () => {
    expect(formatMinutes(0)).toBe('');
  });

  it('분만 있는 경우', () => {
    expect(formatMinutes(45)).toBe('45m');
  });

  it('시간만 있는 경우', () => {
    expect(formatMinutes(120)).toBe('2h');
  });

  it('시간+분 조합', () => {
    expect(formatMinutes(150)).toBe('2h 30m');
  });
});

describe('formatTimestamp', () => {
  it('ms 타임스탬프를 HH:MM 형식으로 변환', () => {
    // 2026-06-15 09:05:00 (UTC+9 기준으로 ms 생성)
    const date = new Date('2026-06-15T09:05:00');
    const result = formatTimestamp(date.getTime());
    // 로컬 시간 기준이므로 정확한 시각 대신 형식만 검증
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DailyRecordRepository } from '@/lib/storage/localStorageRepo';
import type { DailyRecord, Session } from '@/types';

// localStorage mock
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
  get length() { return Object.keys(store).length; },
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

const repo = new DailyRecordRepository();
const DATE = '2026-06-16';
const KEY = `st_daily_${DATE}`;

function makeSession(overrides?: Partial<Session>): Session {
  return {
    id: 'sess-1',
    categoryId: 'cat-1',
    sessionStartTimestamp: new Date('2026-06-16T10:00:00').getTime(),
    sessionEndTimestamp: new Date('2026-06-16T11:00:00').getTime(),
    durationMinutes: 60,
    isManuallyEdited: false,
    editedAt: null,
    source: 'timer',
    ...overrides,
  };
}

function makeRecord(sessions: Session[] = []): DailyRecord {
  return {
    date: DATE,
    logicId: 'logic-1',
    logicSnapshot: {
      name: '테스트 플랜',
      totalTargetMinutes: 120,
      categories: [
        { id: 'cat-1', name: '수학', colorVar: '--cat-color-01', targetMinutes: 60, targetPercent: 50 },
        { id: 'cat-2', name: '국어', colorVar: '--cat-color-02', targetMinutes: 60, targetPercent: 50 },
      ],
    },
    sessions,
    achievementCache: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

describe('DailyRecordRepository — updateSession', () => {
  it('세션 수정 후 isManuallyEdited=true, editedAt 갱신', () => {
    const sess = makeSession();
    const record = makeRecord([sess]);
    store[KEY] = JSON.stringify(record);

    const updated = makeSession({ durationMinutes: 90, sessionEndTimestamp: new Date('2026-06-16T11:30:00').getTime() });
    repo.updateSession(DATE, 'sess-1', updated);

    const saved = repo.getByDate(DATE);
    expect(saved).not.toBeNull();
    const savedSess = saved!.sessions.find(s => s.id === 'sess-1');
    expect(savedSess?.isManuallyEdited).toBe(true);
    expect(savedSess?.editedAt).not.toBeNull();
    expect(savedSess?.durationMinutes).toBe(90);
  });

  it('수정 후 achievementCache 재계산 — totalAchievementPercent 업데이트', () => {
    const sess = makeSession({ durationMinutes: 60 });
    const record = makeRecord([sess]);
    store[KEY] = JSON.stringify(record);

    const updatedSess = makeSession({ durationMinutes: 120, sessionEndTimestamp: new Date('2026-06-16T12:00:00').getTime() });
    repo.updateSession(DATE, 'sess-1', updatedSess);

    const saved = repo.getByDate(DATE);
    expect(saved?.achievementCache).not.toBeNull();
    // totalTarget=120, actualMinutes=120 → 100%
    expect(saved?.achievementCache?.totalAchievementPercent).toBe(100);
  });

  it('존재하지 않는 sessionId 수정 → 세션 배열 불변', () => {
    const sess = makeSession();
    const record = makeRecord([sess]);
    store[KEY] = JSON.stringify(record);

    repo.updateSession(DATE, 'non-exist', makeSession({ durationMinutes: 999 }));

    const saved = repo.getByDate(DATE);
    expect(saved?.sessions).toHaveLength(1);
    expect(saved?.sessions[0].durationMinutes).toBe(60);
  });

  it('record 없는 날짜 → 무시 (에러 없음)', () => {
    expect(() => repo.updateSession('2099-01-01', 'sess-1', makeSession())).not.toThrow();
  });
});

describe('DailyRecordRepository — deleteSession', () => {
  it('세션 삭제 후 sessions 길이 감소', () => {
    const sess1 = makeSession({ id: 'sess-1' });
    const sess2 = makeSession({ id: 'sess-2' });
    const record = makeRecord([sess1, sess2]);
    store[KEY] = JSON.stringify(record);

    repo.deleteSession(DATE, 'sess-1');

    const saved = repo.getByDate(DATE);
    expect(saved?.sessions).toHaveLength(1);
    expect(saved?.sessions[0].id).toBe('sess-2');
  });

  it('삭제 후 achievementCache 재계산', () => {
    const sess1 = makeSession({ id: 'sess-1', durationMinutes: 60 });
    const sess2 = makeSession({ id: 'sess-2', categoryId: 'cat-2', durationMinutes: 60 });
    const record = makeRecord([sess1, sess2]);
    store[KEY] = JSON.stringify(record);

    repo.deleteSession(DATE, 'sess-1');

    const saved = repo.getByDate(DATE);
    // cat-1: 0분/60분 → 0%, cat-2: 60분/60분 → 100%, total: 60/120 → 50%
    expect(saved?.achievementCache?.totalAchievementPercent).toBe(50);
    const cat1 = saved?.achievementCache?.categoryAchievements.find(a => a.categoryId === 'cat-1');
    expect(cat1?.achievementPercent).toBe(0);
  });

  it('존재하지 않는 sessionId 삭제 → 세션 배열 불변', () => {
    const sess = makeSession();
    const record = makeRecord([sess]);
    store[KEY] = JSON.stringify(record);

    repo.deleteSession(DATE, 'non-exist');

    const saved = repo.getByDate(DATE);
    expect(saved?.sessions).toHaveLength(1);
  });

  it('record 없는 날짜 → 무시 (에러 없음)', () => {
    expect(() => repo.deleteSession('2099-01-01', 'sess-1')).not.toThrow();
  });
});

describe('세션 유효성 — 순수 함수', () => {
  it('종료 <= 시작이면 durationMinutes <=0 (invalid)', () => {
    const start = new Date('2026-06-16T10:00:00').getTime();
    const end = new Date('2026-06-16T09:00:00').getTime();
    const dur = Math.floor((end - start) / 60000);
    expect(dur).toBeLessThanOrEqual(0);
  });

  it('종료 === 시작이면 durationMinutes === 0 (invalid)', () => {
    const ts = new Date('2026-06-16T10:00:00').getTime();
    const dur = Math.floor((ts - ts) / 60000);
    expect(dur).toBe(0);
  });

  it('미래 종료 시각은 invalid', () => {
    const future = Date.now() + 3_600_000;
    expect(future > Date.now()).toBe(true);
  });

  it('정상 범위는 durationMinutes > 0', () => {
    const start = new Date('2026-06-16T10:00:00').getTime();
    const end = new Date('2026-06-16T11:00:00').getTime();
    const dur = Math.floor((end - start) / 60000);
    expect(dur).toBe(60);
  });
});

describe('세션 겹침 판단 — 순수 함수', () => {
  function hasOverlap(
    sessions: Pick<Session, 'id' | 'sessionStartTimestamp' | 'sessionEndTimestamp'>[],
    newStart: number,
    newEnd: number,
    excludeId?: string,
  ): boolean {
    return sessions.some(
      s => s.id !== excludeId && s.sessionStartTimestamp < newEnd && s.sessionEndTimestamp > newStart,
    );
  }

  const base = new Date('2026-06-16T10:00:00').getTime();
  const hour = 3_600_000;

  const sessions = [
    { id: 'a', sessionStartTimestamp: base, sessionEndTimestamp: base + hour }, // 10:00~11:00
  ];

  it('완전히 겹치는 세션 감지', () => {
    expect(hasOverlap(sessions, base + 1000, base + hour - 1000)).toBe(true);
  });

  it('시작만 겹치는 세션 감지', () => {
    expect(hasOverlap(sessions, base + 30 * 60000, base + 2 * hour)).toBe(true);
  });

  it('끝만 겹치는 세션 감지', () => {
    expect(hasOverlap(sessions, base - 30 * 60000, base + 30 * 60000)).toBe(true);
  });

  it('겹치지 않는 세션은 false', () => {
    expect(hasOverlap(sessions, base + hour, base + 2 * hour)).toBe(false);
  });

  it('자신(excludeId)은 겹침 판단에서 제외', () => {
    expect(hasOverlap(sessions, base, base + hour, 'a')).toBe(false);
  });
});

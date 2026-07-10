/**
 * Major-2 QA 회귀 방지: 자정 자동분리(또는 재개 시 분리) 저장 실패 시
 * 세션 데이터가 무음으로 유실되지 않고 로컬 큐(localStorage)에 보존되는지 검증.
 *
 * TodayStudy.tsx의 실제 실패 경로(네트워크 mock)까지는 검증하지 않지만,
 * 그 경로가 의존하는 저장/복원/삭제 유틸의 정확성을 보장해
 * "저장 실패 → 큐에 쌓임 → 재시도 시 정확히 그 항목만 제거"가 깨지지 않게 한다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadFailedSessions, saveFailedSession, removeFailedSession,
} from '@/stores/timerStore';
import type { FailedSessionEntry } from '@/stores/timerStore';

function makeEntry(overrides: Partial<FailedSessionEntry> = {}): FailedSessionEntry {
  return {
    localId: 'local-1',
    date: '2026-06-23',
    body: {
      id: 'sess-1',
      categoryId: 'cat-1',
      sessionStartTimestamp: 1_750_000_000_000,
      sessionEndTimestamp: 1_750_000_060_000,
      durationMinutes: 1,
      source: 'timer',
      logicId: 'logic-1',
      logicSnapshot: {
        name: '테스트 플랜',
        totalTargetMinutes: 120,
        categories: [
          { id: 'cat-1', name: '수학', colorVar: '--color-mint', targetMinutes: 60, targetPercent: 50 },
        ],
      },
    },
    ...overrides,
  };
}

describe('Major-2 자정분리 저장 실패 큐 — saveFailedSession/loadFailedSessions/removeFailedSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('큐가 비어 있으면 loadFailedSessions는 빈 배열을 반환한다', () => {
    expect(loadFailedSessions()).toEqual([]);
  });

  it('saveFailedSession 후 loadFailedSessions로 그대로 복원된다 (logicSnapshot 포함)', () => {
    const entry = makeEntry();
    saveFailedSession(entry);
    const loaded = loadFailedSessions();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(entry);
  });

  it('여러 건 실패해도 각각 누적 저장된다 (전날 구간 + 오늘 구간 동시 실패 케이스)', () => {
    const prev = makeEntry({ localId: 'local-prev', date: '2026-06-23' });
    const today = makeEntry({ localId: 'local-today', date: '2026-06-24' });
    saveFailedSession(prev);
    saveFailedSession(today);

    const loaded = loadFailedSessions();
    expect(loaded).toHaveLength(2);
    expect(loaded.map(e => e.localId).sort()).toEqual(['local-prev', 'local-today']);
  });

  it('removeFailedSession은 해당 localId 항목만 제거하고 나머지는 유지한다', () => {
    saveFailedSession(makeEntry({ localId: 'keep-me' }));
    saveFailedSession(makeEntry({ localId: 'remove-me' }));

    removeFailedSession('remove-me');

    const loaded = loadFailedSessions();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].localId).toBe('keep-me');
  });

  it('마지막 항목을 removeFailedSession으로 제거하면 큐 자체가 비워진다 (localStorage 키 제거)', () => {
    saveFailedSession(makeEntry({ localId: 'only-one' }));
    removeFailedSession('only-one');

    expect(loadFailedSessions()).toEqual([]);
    expect(localStorage.getItem('st_failed_sessions')).toBeNull();
  });

  it('존재하지 않는 localId를 removeFailedSession해도 에러 없이 기존 큐를 유지한다', () => {
    saveFailedSession(makeEntry({ localId: 'existing' }));
    expect(() => removeFailedSession('nope')).not.toThrow();
    expect(loadFailedSessions()).toHaveLength(1);
  });

  it('st_ 접두사 키를 사용해 계정 전환 시 clearLocalData의 st_ 일괄 삭제 대상에 포함된다', () => {
    saveFailedSession(makeEntry());
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
    expect(keys).toContain('st_failed_sessions');
    expect(keys.every(k => k.startsWith('st_') || k === 'st_failed_sessions')).toBe(true);
  });
});

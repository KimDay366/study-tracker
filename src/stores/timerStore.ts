import { create } from 'zustand';
import type { SessionAddInput } from '@/api/daily-records';
import { generateId } from '@/lib/uuid';

export type TimerStatus = 'idle' | 'running' | 'paused';

const SESSION_DRAFT_KEY = 'st_session_draft';
const FAILED_SESSION_KEY = 'st_failed_sessions';

export interface SessionDraft {
  categoryId: string;
  sessionStartTimestamp: number;
  pauseOffset: number;
  pausedAt: number | null;
  status: 'running' | 'paused';
  /** 세션당 1개 고정 id. 저장/재시도/flush가 모두 이 id를 재사용해 서버 중복 저장을 막는다. */
  sessionId?: string;
}

export function saveSessionDraft(draft: SessionDraft): void {
  try {
    sessionStorage.setItem(SESSION_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // sessionStorage 실패 시 무시 (Private 모드 등)
  }
}

export function loadSessionDraft(): SessionDraft | null {
  try {
    const raw = sessionStorage.getItem(SESSION_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionDraft;
  } catch {
    return null;
  }
}

export function clearSessionDraft(): void {
  try {
    sessionStorage.removeItem(SESSION_DRAFT_KEY);
  } catch {
    // ignore
  }
}

/**
 * 자정 자동분리(또는 재개 시 분리) 저장이 네트워크 실패 등으로 서버에 반영되지 못했을 때,
 * 그 세션 데이터를 유실하지 않도록 로컬에 보존해 두는 큐.
 * localStorage 사용: 타이머 draft(sessionStorage, 진행 중 세션용)와 달리
 * 이미 "종료된" 세션 데이터이므로 탭을 닫아도 남아 있어야 다음 접속 때 복구를 시도할 수 있다.
 */
export interface FailedSessionEntry {
  /** 복구 성공 후 큐에서 제거할 때 사용하는 로컬 식별자(서버 세션 id와 무관) */
  localId: string;
  date: string;
  body: SessionAddInput;
}

export function loadFailedSessions(): FailedSessionEntry[] {
  try {
    const raw = localStorage.getItem(FAILED_SESSION_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FailedSessionEntry[];
  } catch {
    return [];
  }
}

export function saveFailedSession(entry: FailedSessionEntry): void {
  try {
    const list = loadFailedSessions();
    list.push(entry);
    localStorage.setItem(FAILED_SESSION_KEY, JSON.stringify(list));
  } catch {
    // localStorage 실패(Private 모드 등) — 실패 토스트로 이미 알렸으므로 추가 복구는 포기
  }
}

export function removeFailedSession(localId: string): void {
  try {
    const list = loadFailedSessions().filter((e) => e.localId !== localId);
    if (list.length > 0) {
      localStorage.setItem(FAILED_SESSION_KEY, JSON.stringify(list));
    } else {
      localStorage.removeItem(FAILED_SESSION_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * 큐에 남은 실패 세션을 순서대로 1회씩 재전송 시도한다(best-effort).
 * 성공한 항목만 큐에서 제거하고 실패한 항목은 그대로 남겨 다음 기회에 다시 시도한다.
 * 실제 저장 방식(React Query mutation 등)은 호출부가 주입한다 — 스토어는 저장 수단을 모른다.
 * 호출 지점: TodayStudy 마운트 시 자동 재시도, Settings 로그아웃 직전 best-effort flush.
 */
export async function flushFailedSessions(
  save: (date: string, body: SessionAddInput) => Promise<unknown>,
): Promise<{ recovered: number; remaining: number }> {
  const pending = loadFailedSessions();
  let recovered = 0;
  for (const entry of pending) {
    try {
      await save(entry.date, entry.body);
      removeFailedSession(entry.localId);
      recovered += 1;
    } catch {
      // 이번에도 실패 — 큐에 남겨 다음 기회에 다시 시도
    }
  }
  return { recovered, remaining: pending.length - recovered };
}

interface TimerState {
  status: TimerStatus;
  categoryId: string | null;
  sessionStartTimestamp: number | null;
  pauseOffset: number; // 일시정지 누적 오프셋(ms)
  pausedAt: number | null; // 현재 일시정지 시작 시각(ms)
  sessionId: string | null; // 진행 중 세션의 고정 id(멱등 저장용)
  // Actions
  startTimer: (categoryId: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;
  restoreFromDraft: (draft: SessionDraft) => void;
  getElapsedMs: () => number; // 현재 경과 시간(ms) 조회
}

export const useTimerStore = create<TimerState>((set, get) => ({
  status: 'idle',
  categoryId: null,
  sessionStartTimestamp: null,
  pauseOffset: 0,
  pausedAt: null,
  sessionId: null,

  startTimer: (categoryId: string) => {
    const now = Date.now();
    const sessionId = generateId();
    const draft: SessionDraft = {
      categoryId,
      sessionStartTimestamp: now,
      pauseOffset: 0,
      pausedAt: null,
      status: 'running',
      sessionId,
    };
    saveSessionDraft(draft);
    set({
      status: 'running',
      categoryId,
      sessionStartTimestamp: now,
      pauseOffset: 0,
      pausedAt: null,
      sessionId,
    });
  },

  pauseTimer: () => {
    const { status, categoryId, sessionStartTimestamp, pauseOffset, sessionId } = get();
    if (status !== 'running') return;
    const pausedAt = Date.now();
    if (categoryId && sessionStartTimestamp !== null) {
      saveSessionDraft({ categoryId, sessionStartTimestamp, pauseOffset, pausedAt, status: 'paused', sessionId: sessionId ?? undefined });
    }
    set({ status: 'paused', pausedAt });
  },

  resumeTimer: () => {
    const { status, pausedAt, pauseOffset, categoryId, sessionStartTimestamp, sessionId } = get();
    if (status !== 'paused' || pausedAt === null) return;
    const addedOffset = Date.now() - pausedAt;
    const newOffset = pauseOffset + addedOffset;
    if (categoryId && sessionStartTimestamp !== null) {
      saveSessionDraft({ categoryId, sessionStartTimestamp, pauseOffset: newOffset, pausedAt: null, status: 'running', sessionId: sessionId ?? undefined });
    }
    set({ status: 'running', pauseOffset: newOffset, pausedAt: null });
  },

  stopTimer: () => {
    clearSessionDraft();
    set({
      status: 'idle',
      categoryId: null,
      sessionStartTimestamp: null,
      pauseOffset: 0,
      pausedAt: null,
      sessionId: null,
    });
  },

  resetTimer: () => {
    clearSessionDraft();
    set({
      status: 'idle',
      categoryId: null,
      sessionStartTimestamp: null,
      pauseOffset: 0,
      pausedAt: null,
      sessionId: null,
    });
  },

  restoreFromDraft: (draft: SessionDraft) => {
    set({
      status: draft.status,
      categoryId: draft.categoryId,
      sessionStartTimestamp: draft.sessionStartTimestamp,
      pauseOffset: draft.pauseOffset,
      pausedAt: draft.pausedAt,
      // 옛 draft(sessionId 없음) 복원 시에도 저장이 가능하도록 새 id 부여
      sessionId: draft.sessionId ?? generateId(),
    });
  },

  getElapsedMs: () => {
    const { status, sessionStartTimestamp, pauseOffset, pausedAt } = get();
    if (status === 'idle' || sessionStartTimestamp === null) return 0;
    if (status === 'paused' && pausedAt !== null) {
      // 일시정지 중: pausedAt까지만 계산
      return pausedAt - sessionStartTimestamp - pauseOffset;
    }
    return Date.now() - sessionStartTimestamp - pauseOffset;
  },
}));

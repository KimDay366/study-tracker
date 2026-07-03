import { create } from 'zustand';

export type TimerStatus = 'idle' | 'running' | 'paused';

const SESSION_DRAFT_KEY = 'st_session_draft';

export interface SessionDraft {
  categoryId: string;
  sessionStartTimestamp: number;
  pauseOffset: number;
  pausedAt: number | null;
  status: 'running' | 'paused';
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

interface TimerState {
  status: TimerStatus;
  categoryId: string | null;
  sessionStartTimestamp: number | null;
  pauseOffset: number; // 일시정지 누적 오프셋(ms)
  pausedAt: number | null; // 현재 일시정지 시작 시각(ms)
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

  startTimer: (categoryId: string) => {
    const now = Date.now();
    const draft: SessionDraft = {
      categoryId,
      sessionStartTimestamp: now,
      pauseOffset: 0,
      pausedAt: null,
      status: 'running',
    };
    saveSessionDraft(draft);
    set({
      status: 'running',
      categoryId,
      sessionStartTimestamp: now,
      pauseOffset: 0,
      pausedAt: null,
    });
  },

  pauseTimer: () => {
    const { status, categoryId, sessionStartTimestamp, pauseOffset } = get();
    if (status !== 'running') return;
    const pausedAt = Date.now();
    if (categoryId && sessionStartTimestamp !== null) {
      saveSessionDraft({ categoryId, sessionStartTimestamp, pauseOffset, pausedAt, status: 'paused' });
    }
    set({ status: 'paused', pausedAt });
  },

  resumeTimer: () => {
    const { status, pausedAt, pauseOffset, categoryId, sessionStartTimestamp } = get();
    if (status !== 'paused' || pausedAt === null) return;
    const addedOffset = Date.now() - pausedAt;
    const newOffset = pauseOffset + addedOffset;
    if (categoryId && sessionStartTimestamp !== null) {
      saveSessionDraft({ categoryId, sessionStartTimestamp, pauseOffset: newOffset, pausedAt: null, status: 'running' });
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
    });
  },

  restoreFromDraft: (draft: SessionDraft) => {
    set({
      status: draft.status,
      categoryId: draft.categoryId,
      sessionStartTimestamp: draft.sessionStartTimestamp,
      pauseOffset: draft.pauseOffset,
      pausedAt: draft.pausedAt,
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

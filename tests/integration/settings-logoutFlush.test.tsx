/**
 * Minor-2 QA 재검증: 로그아웃 시 clearSessionAndCache가 st_ 접두사 스토리지를 통째로 비우는데,
 * 그 안에는 자정분리/수동정지 저장 실패로 쌓인 st_failed_sessions 큐도 포함된다.
 * 재방문(자동 재시도) 전에 로그아웃하면 미복구 데이터가 영구 삭제되는 좁은 유실 창이 있었다.
 * 로그아웃 직전 큐를 한 번 더 조용히(best-effort) flush해 이 유실 창을 최소화하는지 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Settings } from '@/pages/Settings';
import { saveFailedSession, loadFailedSessions } from '@/stores/timerStore';
import type { FailedSessionEntry } from '@/stores/timerStore';
import { useAuthStore } from '@/stores/authStore';

const mockLogout = vi.fn();
vi.mock('@/api/auth', () => ({
  logout: (...args: unknown[]) => mockLogout(...args),
}));

vi.mock('@/hooks/query/useSettings', () => ({
  useSettings: () => ({ data: null }),
}));

const mockMutateAsync = vi.fn();
vi.mock('@/hooks/query/useDailyRecords', () => ({
  useAddSession: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

function makeEntry(localId: string): FailedSessionEntry {
  return {
    localId,
    date: '2026-07-05',
    body: {
      id: `sess-${localId}`,
      categoryId: 'cat-1',
      sessionStartTimestamp: 1_750_000_000_000,
      sessionEndTimestamp: 1_750_000_060_000,
      durationMinutes: 1,
      source: 'timer',
      logicId: 'logic-1',
      logicSnapshot: {
        name: '테스트 플랜',
        totalTargetMinutes: 60,
        categories: [
          { id: 'cat-1', name: '수학', colorVar: '--cat-color-01', targetMinutes: 60, targetPercent: 100 },
        ],
      },
    },
  };
}

function renderSettings() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Settings />
    </QueryClientProvider>,
  );
}

// jsdom은 window.location.href 대입을 실제 이동으로 처리하지 못해 콘솔 에러를 남길 수 있으나
// 테스트 통과 여부에는 영향 없다 — 여기서는 flush/logout 호출 여부와 큐 상태만 검증한다.

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  mockLogout.mockResolvedValue(undefined);
  useAuthStore.setState({
    status: 'authenticated',
    user: { id: '1', email: 'a@a.com', nickname: '닉네임', role: 'user' },
  });
});

describe('Settings 로그아웃 — 실패 큐 best-effort flush (Minor-2)', () => {
  it('큐에 미복구 세션이 있으면 로그아웃 전 재전송을 시도하고, 성공하면 그 항목으로 저장을 호출한다', async () => {
    saveFailedSession(makeEntry('a'));
    mockMutateAsync.mockResolvedValue({ id: 'recovered' });

    renderSettings();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    });

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-07-05', body: expect.objectContaining({ categoryId: 'cat-1' }) }),
    );
    // flush 성공 → 로그아웃의 clearSessionAndCache 전에 이미 큐에서 제거됨
    expect(loadFailedSessions()).toEqual([]);
  });

  it('재전송도 실패하면 로그아웃은 그대로 진행된다 (best-effort — 로그아웃을 막지 않음)', async () => {
    saveFailedSession(makeEntry('b'));
    mockMutateAsync.mockRejectedValue(new Error('offline'));

    renderSettings();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    });

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });

    // flush 재시도는 이루어졌으나 실패 → clearSessionAndCache가 st_ 전체를 비워 결과적으로 큐도 비워진다(기존 동작 유지)
    expect(mockMutateAsync).toHaveBeenCalled();
    expect(loadFailedSessions()).toEqual([]);
  });

  it('큐가 비어 있으면 불필요한 저장 호출 없이 로그아웃이 그대로 진행된다 (정상 흐름 회귀 방지)', async () => {
    renderSettings();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    });

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});

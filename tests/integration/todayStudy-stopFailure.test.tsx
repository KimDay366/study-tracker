/**
 * Minor-3 QA 재검증: 자정분리 저장 실패는 이미 st_failed_sessions 큐에 보존되는데,
 * 가장 흔한 경로인 수동 "정지" 버튼 저장 실패는 토스트만 띄우고 데이터를 폐기하고 있었다.
 * 두 경로의 일관성을 맞춰, 정지 저장 실패 시에도 세션을 큐에 보존해 다음 접속 때
 * 자동 재시도(마운트 시 flushFailedSessions)되도록 한다. 기존 실패 토스트는 그대로 유지되어야 한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TodayStudy } from '@/pages/TodayStudy';
import { loadFailedSessions } from '@/stores/timerStore';
import { useTimerStore } from '@/stores/timerStore';
import { useUIStore } from '@/stores/uiStore';

const mockLogic = {
  id: 'logic-1',
  name: '테스트 로직',
  totalTargetMinutes: 60,
  categories: [
    { id: 'cat-1', name: '수학', colorVar: '--cat-color-01', targetMinutes: 60, targetPercent: 100 },
  ],
  createdAt: '',
  updatedAt: '',
};

const mockMutateAsync = vi.fn();

vi.mock('@/hooks/query/useLogics', () => ({
  useLogics: () => ({ data: [mockLogic], isLoading: false, isError: false }),
}));
vi.mock('@/hooks/query/useDailyRecords', () => ({
  // 다중 로직 대응: useDailyRecord는 이제 그 날짜의 로직 그룹 배열을 반환한다(빈 배열 = 기록 없음).
  useDailyRecord: () => ({ data: [] }),
  useAddSession: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useUpdateSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/query/useSettings', () => ({
  useSettings: () => ({ data: null }),
  usePatchSettings: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/query/useRoutine', () => ({
  useRoutineQuery: () => ({ data: null }),
  useUpsertRoutine: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function renderTodayStudy() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/', element: <TodayStudy /> }], { initialEntries: ['/'] });
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mockMutateAsync.mockReset();
  useTimerStore.getState().resetTimer();
  useUIStore.setState({ toasts: [] });

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('handleStop 저장 실패 — st_failed_sessions 큐 보존 (Minor-3 일관성 보강)', () => {
  it('1분 이상 경과 후 정지 시 저장이 실패하면, danger 토스트를 띄우고 세션을 실패 큐에 보존한다', async () => {
    vi.useFakeTimers();
    mockMutateAsync.mockRejectedValue(new Error('network error'));

    renderTodayStudy();

    fireEvent.click(screen.getByRole('button', { name: '수학 카테고리 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '타이머 시작' }));

    // 1분 이상 경과시켜 저장 대상(durationMinutes >= 1)으로 만든다
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '타이머 정지' }));
    });

    // 기존 실패 토스트는 그대로 유지되어야 한다
    const toasts = useUIStore.getState().toasts;
    expect(toasts.some(t => t.message === '저장 중 오류가 발생했어요.' && t.type === 'danger')).toBe(true);

    // 실패한 세션은 폐기되지 않고 큐에 보존되어야 한다
    const queue = loadFailedSessions();
    expect(queue).toHaveLength(1);
    expect(queue[0].body.categoryId).toBe('cat-1');
    expect(queue[0].body.source).toBe('timer');
    expect(queue[0].body.durationMinutes).toBeGreaterThanOrEqual(1);
  });

  it('저장이 성공하면 큐에 아무것도 쌓이지 않는다 (정상 흐름 회귀 방지)', async () => {
    vi.useFakeTimers();
    mockMutateAsync.mockResolvedValue({ id: 'server-session-1' });

    renderTodayStudy();

    fireEvent.click(screen.getByRole('button', { name: '수학 카테고리 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '타이머 시작' }));

    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '타이머 정지' }));
    });

    const toasts = useUIStore.getState().toasts;
    expect(toasts.some(t => /분 기록 완료/.test(t.message) && t.type === 'success')).toBe(true);
    expect(loadFailedSessions()).toEqual([]);
  });
});

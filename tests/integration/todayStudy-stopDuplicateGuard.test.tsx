/**
 * 정지 연타/토큰만료 지연으로 인한 "중복 저장 + 안 멈추는 초시계" 회귀 방지.
 *
 * 재현: 긴 세션에서 정지 → 저장 API가 느리게 응답하는 동안 초시계가 계속 흐르면
 * 사용자가 "안 멈췄다"고 오해해 정지를 연타 → 매번 새 요청/새 id로 중복 저장.
 *
 * 보장해야 할 것:
 *  1) 정지를 누른 즉시 타이머가 멈춘다(status가 running이 아니게 됨).
 *  2) 저장이 진행 중이면 연타해도 저장 요청은 1회만 나간다(재진입/버튼 비활성 가드).
 *  3) 저장 body.id는 세션 시작 시 고정된 sessionId를 재사용한다(서버 멱등 보장).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TodayStudy } from '@/pages/TodayStudy';
import { useTimerStore } from '@/stores/timerStore';
import { useUIStore } from '@/stores/uiStore';

const mockLogic = {
  id: 'logic-1',
  name: '테스트 플랜',
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

describe('정지 즉시 멈춤 + 연타 중복 저장 방지 + 고정 sessionId', () => {
  it('저장이 느려도 연타 시 저장은 1회만 나가고, 누른 즉시 타이머가 멈추며, body.id는 시작 시 고정 id를 재사용한다', async () => {
    vi.useFakeTimers();
    // 저장 API를 "느리게" — 수동으로 resolve할 때까지 pending 상태로 둔다(토큰만료 refresh 지연 흉내)
    let resolveSave: (v: unknown) => void = () => {};
    mockMutateAsync.mockImplementation(() => new Promise((r) => { resolveSave = r; }));

    renderTodayStudy();

    fireEvent.click(screen.getByRole('button', { name: '수학 활동 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '타이머 시작' }));

    // 세션 시작 시 고정된 sessionId 확보
    const fixedId = useTimerStore.getState().sessionId;
    expect(fixedId).toBeTruthy();

    // 1분 이상 경과(저장 대상)
    await act(async () => { vi.advanceTimersByTime(61_000); });
    expect(useTimerStore.getState().status).toBe('running');

    // 첫 정지 — 저장은 pending으로 매달린다
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '타이머 정지' }));
    });

    // (1) 누른 즉시 멈춤 — 더 이상 running이 아니다
    expect(useTimerStore.getState().status).not.toBe('running');
    // 버튼은 "저장 중…"으로 바뀌고 비활성이어야 한다
    const savingBtn = screen.getByRole('button', { name: '타이머 정지' });
    expect(savingBtn).toBeDisabled();
    expect(savingBtn.textContent).toContain('저장 중');

    // (2) 저장 진행 중 연타 — 추가 요청이 나가면 안 된다
    await act(async () => {
      fireEvent.click(savingBtn);
      fireEvent.click(savingBtn);
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);

    // (3) 저장 body.id == 시작 시 고정 id
    expect(mockMutateAsync.mock.calls[0][0].body.id).toBe(fixedId);

    // 저장 완료 처리 — 타이머가 idle로 리셋되고 성공 토스트
    await act(async () => {
      resolveSave({ id: 'server-session-1' });
    });
    expect(useTimerStore.getState().status).toBe('idle');
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    const toasts = useUIStore.getState().toasts;
    expect(toasts.some((t) => /분 기록 완료/.test(t.message) && t.type === 'success')).toBe(true);
  });
});

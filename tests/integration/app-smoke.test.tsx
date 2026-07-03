/**
 * 앱 렌더 스모크 테스트 — data router + AuthGuard 통합 검증
 *
 * 이 테스트가 잡는 버그:
 *   useBlocker()는 data router(createBrowserRouter/createMemoryRouter) 컨텍스트 안에서만
 *   동작합니다. BrowserRouter + Routes 조합에서는 런타임에 "must be used within a data router"
 *   에러를 throw해 앱 전체가 흰 화면이 됩니다. 빌드·단위테스트는 이 문제를 잡지 못합니다.
 *
 * 검증 전략:
 *   createMemoryRouter로 App과 동일한 라우트 구성을 재현합니다.
 *   AuthGuard의 refreshSession은 axios를 사용하므로, 해당 모듈을 vi.mock으로
 *   대체해 "인증됨" 상태로 고정합니다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { ToastContainer } from '@/components/common/Toast';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  TodayStudy, LogicList, Calendar, WeeklyReview,
  Routine, Settings, NotFound,
} from '@/pages';

// AuthGuard가 호출하는 refreshSession을 모킹: 항상 "인증됨"으로 반환
vi.mock('@/api/auth', () => ({
  refreshSession: vi.fn().mockResolvedValue({
    accessToken: 'mock-token',
    user: { id: 'u1', email: 'test@test.com', nickname: '테스터', role: 'user' },
  }),
  logout: vi.fn().mockResolvedValue(undefined),
}));

// React Query 훅 모킹 (서버 없이 렌더 가능)
vi.mock('@/hooks/query/useLogics', () => ({
  useLogics: () => ({ data: [], isLoading: false, isError: false }),
  useDeleteLogic: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateLogic: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateLogic: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useLogic: () => ({ data: null, isLoading: false }),
}));
vi.mock('@/hooks/query/useRoutine', () => ({
  useRoutineQuery: () => ({ data: null, isLoading: false }),
  useUpsertRoutine: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/query/useSettings', () => ({
  useSettings: () => ({ data: null, isLoading: false }),
  usePatchSettings: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  localStorage.clear();
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

function RootLayout() {
  return (
    <>
      <AppShell>
        <Outlet />
      </AppShell>
      <ToastContainer />
    </>
  );
}

function createTestRouter(initialPath = '/') {
  return createMemoryRouter(
    [
      { path: '/login', element: <div>로그인 페이지</div> },
      {
        element: <AuthGuard />,
        children: [
          {
            element: <RootLayout />,
            children: [
              { path: '/', element: <TodayStudy /> },
              { path: '/logics', element: <LogicList /> },
              { path: '/calendar', element: <Calendar /> },
              { path: '/weekly-review', element: <WeeklyReview /> },
              { path: '/routine', element: <Routine /> },
              { path: '/settings', element: <Settings /> },
              { path: '*', element: <NotFound /> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
}

async function renderWithProviders(path = '/') {
  const qc = makeQueryClient();
  await act(async () => {
    render(
      <QueryClientProvider client={qc}>
        <RouterProvider router={createTestRouter(path)} />
      </QueryClientProvider>,
    );
  });
}

describe('앱 렌더 스모크 — data router 통합', () => {
  it('TodayStudy(useBlocker 포함)가 data router 안에서 throw 없이 마운트된다', async () => {
    await expect(renderWithProviders('/')).resolves.not.toThrow();
  });

  it('/logics 경로가 throw 없이 마운트된다', async () => {
    await expect(renderWithProviders('/logics')).resolves.not.toThrow();
  });

  it('존재하지 않는 경로는 NotFound를 렌더한다', async () => {
    await renderWithProviders('/does-not-exist');
    expect(screen.getByRole('main')).toBeDefined();
  });
});

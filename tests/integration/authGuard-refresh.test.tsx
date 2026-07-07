/**
 * 백엔드 보안 강화 후속: POST /refresh가 이제 403 AUTH_ACCOUNT_SUSPENDED / AUTH_ACCOUNT_DELETED도
 * 반환할 수 있다. AuthGuard가 이 두 코드를 감지해 /login?error=account_suspended|account_deleted로
 * 리다이렉트하고, Login이 그 쿼리파라미터를 읽어 사유 안내 배너를 띄우는지 검증한다.
 * 그 외 일반 refresh 실패(null)는 기존처럼 배너 없이 조용히 로그인 화면으로 보내야 한다(회귀 방지).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Login } from '@/pages/Login';
import { useAuthStore } from '@/stores/authStore';

vi.mock('@/api/auth', () => ({
  refreshSession: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  resendVerification: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
}));

import * as authApi from '@/api/auth';
const mockRefreshSession = vi.mocked(authApi.refreshSession);

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

async function renderApp(initialPath = '/') {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <Login /> },
      {
        element: <AuthGuard />,
        children: [{ path: '/', element: <div>보호된 화면</div> }],
      },
    ],
    { initialEntries: [initialPath] },
  );
  await act(async () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // useAuthStore는 zustand 싱글턴이라 테스트 간 상태가 이어진다 — 매 테스트 idle로 리셋
  useAuthStore.setState({ status: 'idle', user: null });
});

describe('AuthGuard — refresh 실패 시 정지/탈퇴 계정 안내 리다이렉트', () => {
  it('AUTH_ACCOUNT_SUSPENDED → /login?error=account_suspended로 이동, 정지 안내 배너 표시', async () => {
    mockRefreshSession.mockRejectedValue({ response: { data: { code: 'AUTH_ACCOUNT_SUSPENDED' } } });

    await renderApp('/');

    expect(await screen.findByRole('alert')).toHaveTextContent('정지된 계정');
  });

  it('AUTH_ACCOUNT_DELETED → /login?error=account_deleted로 이동, 탈퇴 안내 배너 표시', async () => {
    mockRefreshSession.mockRejectedValue({ response: { data: { code: 'AUTH_ACCOUNT_DELETED' } } });

    await renderApp('/');

    expect(await screen.findByRole('alert')).toHaveTextContent('탈퇴 처리된 계정');
  });

  it('일반 refresh 실패(null)는 기존처럼 배너 없이 조용히 로그인 화면으로 이동한다 — 회귀 방지', async () => {
    mockRefreshSession.mockResolvedValue(null);

    await renderApp('/');

    expect(await screen.findByRole('tab', { name: '로그인' })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('refresh 성공 시 보호된 화면이 그대로 렌더된다 — 정상 흐름 회귀 방지', async () => {
    mockRefreshSession.mockResolvedValue({
      accessToken: 'tok',
      user: { id: '1', email: 'a@a.com', nickname: '닉네임', role: 'user' },
    });

    await renderApp('/');

    expect(await screen.findByText('보호된 화면')).toBeDefined();
  });
});

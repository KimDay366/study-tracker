/**
 * 이메일 인증 플로우 통합 테스트
 *
 * - 회원가입 성공 → 자동 로그인하지 않고 안내 메시지 표시 + 로그인 탭 전환
 * - 로그인 시 403 AUTH_EMAIL_NOT_VERIFIED → 에러 메시지 + 재발송 버튼
 * - /verify-email?token=xxx → 인증 성공 화면
 * - /verify-email?token=bad → 인증 실패 화면
 * - /verify-email (토큰 없음) → 안내 화면
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Login } from '@/pages/Login';
import { VerifyEmail } from '@/pages/VerifyEmail';

// api/auth 전체를 모킹
vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  signup: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
  refreshSession: vi.fn().mockResolvedValue(null),
}));

import * as authApi from '@/api/auth';
// 타입 캐스팅 (vi.fn()이므로 mockResolvedValue 사용 가능)
const mockLogin = vi.mocked(authApi.login);
const mockSignup = vi.mocked(authApi.signup);
const mockVerifyEmail = vi.mocked(authApi.verifyEmail);
const mockResendVerification = vi.mocked(authApi.resendVerification);

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderLogin() {
  const router = createMemoryRouter([{ path: '/login', element: <Login /> }], {
    initialEntries: ['/login'],
  });
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function renderVerifyEmail(search: string) {
  const router = createMemoryRouter(
    [{ path: '/verify-email', element: <VerifyEmail /> }],
    { initialEntries: [`/verify-email${search}`] },
  );
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// ── 회원가입 플로우 ──────────────────────────────────────────────
describe('회원가입 성공 플로우', () => {
  it('가입 성공 시 로그인 탭으로 전환되고 인증 안내 메시지가 표시된다', async () => {
    mockSignup.mockResolvedValue({ message: '가입이 완료되었습니다.' });

    renderLogin();

    // 회원가입 탭으로 이동
    fireEvent.click(screen.getByRole('tab', { name: '회원가입' }));

    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '길동이' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'Pass123!@#' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '가입하기' }));
    });

    // 로그인 탭이 선택되어야 함
    expect(screen.getByRole('tab', { name: '로그인' })).toHaveAttribute('aria-selected', 'true');
    // 인증 안내 메시지 표시
    expect(screen.getByRole('status')).toHaveTextContent('test@example.com');
    // authStore에 setAuthenticated가 호출되지 않았으므로 navigate도 없음 (로그인 화면 유지)
    expect(screen.queryByText('오늘의 학습')).toBeNull();
  });

  it('가입에 사용한 이메일이 로그인 폼에 미리 채워진다', async () => {
    mockSignup.mockResolvedValue({ message: '가입이 완료되었습니다.' });

    renderLogin();
    fireEvent.click(screen.getByRole('tab', { name: '회원가입' }));

    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'pre@fill.com' } });
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '길동' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'Pass123!@#' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '가입하기' }));
    });

    // 로그인 탭의 이메일 인풋에 값이 채워져 있어야 함
    const emailInput = screen.getByLabelText('이메일') as HTMLInputElement;
    expect(emailInput.value).toBe('pre@fill.com');
  });
});

// ── 로그인 이메일 미인증 에러 ─────────────────────────────────────
describe('로그인 — AUTH_EMAIL_NOT_VERIFIED', () => {
  it('403 이메일 미인증 에러 시 재발송 버튼이 표시된다', async () => {
    mockLogin.mockRejectedValue({
      response: { data: { code: 'AUTH_EMAIL_NOT_VERIFIED', message: '이메일 인증이 필요합니다.' } },
    });

    renderLogin();
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'unverified@test.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'Pass123!' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent('이메일 인증이 완료되지 않았어요');
    expect(screen.getByRole('button', { name: '인증 메일 재발송' })).toBeDefined();
  });

  it('재발송 버튼 클릭 시 resendVerification이 호출된다', async () => {
    mockLogin.mockRejectedValue({
      response: { data: { code: 'AUTH_EMAIL_NOT_VERIFIED' } },
    });
    mockResendVerification.mockResolvedValue({ message: '발송 완료' });

    renderLogin();
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'unverified@test.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'Pass123!' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '인증 메일 재발송' }));
    });

    expect(mockResendVerification).toHaveBeenCalledWith('unverified@test.com');
    await waitFor(() => {
      expect(screen.getByText(/재발송했어요/)).toBeDefined();
    });
  });
});

// ── /verify-email 페이지 ──────────────────────────────────────────
describe('VerifyEmail 페이지', () => {
  it('토큰 없이 접근하면 안내 문구가 표시된다', () => {
    renderVerifyEmail('');
    expect(screen.getByRole('alert')).toHaveTextContent('유효하지 않은 접근');
  });

  it('유효한 토큰으로 접근하면 인증 성공 메시지가 표시된다', async () => {
    mockVerifyEmail.mockResolvedValue({ message: '인증 완료' });

    await act(async () => {
      renderVerifyEmail('?token=valid-token-123');
    });

    expect(mockVerifyEmail).toHaveBeenCalledWith('valid-token-123');
    expect(screen.getByRole('status')).toHaveTextContent('이메일 인증이 완료되었습니다');
  });

  it('만료된 토큰이면 실패 메시지가 표시된다', async () => {
    mockVerifyEmail.mockRejectedValue({
      response: { data: { message: '토큰이 만료되었습니다.' } },
    });

    await act(async () => {
      renderVerifyEmail('?token=expired-token');
    });

    expect(screen.getByRole('alert')).toHaveTextContent('인증에 실패했어요');
    expect(screen.getByRole('alert')).toHaveTextContent('토큰이 만료되었습니다');
  });
});

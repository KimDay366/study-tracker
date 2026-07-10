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

function renderLogin(search = '') {
  const router = createMemoryRouter([{ path: '/login', element: <Login /> }], {
    initialEntries: [`/login${search}`],
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

// ── 로그인 — 보안 강화 응답 규격 error code 분기 ───────────────────
describe('로그인 — 보안 강화 응답 error code별 안내 문구', () => {
  async function submitLogin(email: string, password: string) {
    renderLogin();
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: email } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: password } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    });
  }

  it('AUTH_INVALID_CREDENTIALS → 계정 존재 여부를 티내지 않는 공통 문구, 재발송 버튼 없음', async () => {
    mockLogin.mockRejectedValue({
      response: { data: { code: 'AUTH_INVALID_CREDENTIALS', message: '자격 증명이 올바르지 않습니다.' } },
    });

    await submitLogin('nobody@test.com', 'wrongpass');

    expect(screen.getByRole('alert')).toHaveTextContent('이메일 또는 비밀번호가 올바르지 않아요');
    expect(screen.queryByRole('button', { name: '인증 메일 재발송' })).toBeNull();
  });

  it('AUTH_ACCOUNT_SUSPENDED → 정지 계정 안내, 재발송 버튼 없음', async () => {
    mockLogin.mockRejectedValue({
      response: { data: { code: 'AUTH_ACCOUNT_SUSPENDED' } },
    });

    await submitLogin('suspended@test.com', 'Pass123!');

    expect(screen.getByRole('alert')).toHaveTextContent('정지된 계정');
    expect(screen.queryByRole('button', { name: '인증 메일 재발송' })).toBeNull();
  });

  it('AUTH_ACCOUNT_DELETED → 탈퇴 계정 안내, 재발송 버튼 없음', async () => {
    mockLogin.mockRejectedValue({
      response: { data: { code: 'AUTH_ACCOUNT_DELETED' } },
    });

    await submitLogin('deleted@test.com', 'Pass123!');

    expect(screen.getByRole('alert')).toHaveTextContent('탈퇴 처리된 계정');
    expect(screen.queryByRole('button', { name: '인증 메일 재발송' })).toBeNull();
  });

  it('AUTH_EMAIL_NOT_VERIFIED만 재발송 버튼을 노출한다 (새 문구 반영)', async () => {
    mockLogin.mockRejectedValue({
      response: { data: { code: 'AUTH_EMAIL_NOT_VERIFIED' } },
    });

    await submitLogin('unverified2@test.com', 'Pass123!');

    expect(screen.getByRole('alert')).toHaveTextContent('이메일 인증이 완료되지 않았어요. 메일함을 확인해 주세요.');
    expect(screen.getByRole('button', { name: '인증 메일 재발송' })).toBeDefined();
  });

  it('AUTH_RATE_LIMITED → 요청 과다 안내 문구, 재발송 버튼 없음', async () => {
    mockLogin.mockRejectedValue({
      response: { data: { code: 'AUTH_RATE_LIMITED', message: 'Too many requests' } },
    });

    await submitLogin('anyone@test.com', 'Pass123!');

    expect(screen.getByRole('alert')).toHaveTextContent('요청이 너무 많아요');
    expect(screen.queryByRole('button', { name: '인증 메일 재발송' })).toBeNull();
  });
});

// ── 구글 로그인 콜백 실패 — ?error 쿼리파라미터 분기 ──────────────────
describe('로그인 — 구글 OAuth 콜백 실패 (?error 쿼리파라미터)', () => {
  it('error=google_unverified → 이메일 미인증 계정 안내 메시지가 표시된다', () => {
    renderLogin('?error=google_unverified');

    expect(screen.getByRole('alert')).toHaveTextContent('이미 이메일로 가입된 계정');
    expect(screen.getByRole('alert')).toHaveTextContent('이메일 인증을 먼저 완료');
  });

  it('error=google → 기존 일반 실패 메시지가 표시된다', () => {
    renderLogin('?error=google');

    expect(screen.getByRole('alert')).toHaveTextContent('구글 로그인에 실패했어요');
  });

  it('error 쿼리파라미터가 없으면 에러 메시지가 표시되지 않는다', () => {
    renderLogin();

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('error=google_unverified 케이스에서는 재발송 버튼이 표시되지 않는다 (이메일 정보 없음)', () => {
    renderLogin('?error=google_unverified');

    expect(screen.getByRole('alert')).toHaveTextContent('이미 이메일로 가입된 계정');
    expect(screen.queryByRole('button', { name: '인증 메일 재발송' })).toBeNull();
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

  it('토큰이 유효하지 않으면 안내 문구가 표시된다', async () => {
    mockVerifyEmail.mockRejectedValue({
      response: { data: { message: '토큰이 만료되었습니다.' } },
    });

    await act(async () => {
      renderVerifyEmail('?token=expired-token');
    });

    expect(screen.getByRole('alert')).toHaveTextContent('인증 링크를 확인할 수 없어요');
    // 이미 인증했거나 재발송이 필요한 두 경우를 모두 안내한다
    expect(screen.getByRole('alert')).toHaveTextContent('이미 인증을 마치셨다면');
    expect(screen.getByRole('alert')).toHaveTextContent('인증 메일을 다시 받아');
  });

  it('토큰이 있으면 페이지당 한 번만 인증 요청한다 (중복 POST 방지)', async () => {
    mockVerifyEmail.mockResolvedValue({ message: '인증 완료' });

    await act(async () => {
      renderVerifyEmail('?token=once-token');
    });

    expect(mockVerifyEmail).toHaveBeenCalledTimes(1);
  });
});

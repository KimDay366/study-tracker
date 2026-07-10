import { apiClient } from './client';
import { setAccessToken } from './tokenStore';
import { getApiErrorCode } from '@/lib/api/errorCode';

// refresh 실패 시 "다시 로그인해 주세요"가 아니라 사유를 알려야 하는 코드.
// 이 코드들만 refreshSession이 삼키지 않고 그대로 throw해 호출부(AuthGuard)가 분기할 수 있게 한다.
const REFRESH_REASON_CODES = new Set(['AUTH_ACCOUNT_SUSPENDED', 'AUTH_ACCOUNT_DELETED']);

export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  role: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignupInput {
  email: string;
  password: string;
  name: string;
  nickname: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface SignupResponse {
  message: string;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', input);
  setAccessToken(data.accessToken);
  return data;
}

export async function signup(input: SignupInput): Promise<SignupResponse> {
  const { data } = await apiClient.post<SignupResponse>('/auth/signup', input);
  return data;
}

/** 이메일 중복확인 — 가입 폼에서 이메일 입력 후 사용 가능 여부를 미리 안내한다. */
export async function checkEmail(email: string): Promise<{ available: boolean }> {
  const { data } = await apiClient.post<{ available: boolean }>('/auth/check-email', { email });
  return data;
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>('/auth/verify-email', { token });
  return data;
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>('/auth/resend-verification', { email });
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
  setAccessToken(null);
}

/**
 * 앱 부팅 시 refresh 쿠키로 access token 복구.
 * 만료/미보유 등 일반 실패는 기존처럼 null로 흡수해 조용히 재로그인 화면으로 보내고,
 * 정지(AUTH_ACCOUNT_SUSPENDED)/탈퇴(AUTH_ACCOUNT_DELETED) 계정은 사유 안내가 필요하므로
 * 그대로 throw해 AuthGuard가 code를 보고 안내 문구를 분기하게 한다.
 */
export async function refreshSession(): Promise<AuthResponse | null> {
  try {
    const { data } = await apiClient.post<AuthResponse>('/auth/refresh');
    setAccessToken(data.accessToken);
    return data;
  } catch (err) {
    const code = getApiErrorCode(err);
    if (code && REFRESH_REASON_CODES.has(code)) {
      throw err;
    }
    return null;
  }
}

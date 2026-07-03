import { apiClient } from './client';
import { setAccessToken } from './tokenStore';

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

/** 앱 부팅 시 refresh 쿠키로 access token 복구 */
export async function refreshSession(): Promise<AuthResponse | null> {
  try {
    const { data } = await apiClient.post<AuthResponse>('/auth/refresh');
    setAccessToken(data.accessToken);
    return data;
  } catch {
    return null;
  }
}

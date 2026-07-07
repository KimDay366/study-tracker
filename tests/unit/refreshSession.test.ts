/**
 * 백엔드 보안 강화 후속: POST /refresh가 403 AUTH_ACCOUNT_SUSPENDED / AUTH_ACCOUNT_DELETED를
 * 반환할 수 있게 되면서, refreshSession()이 이 두 코드는 삼키지 않고 그대로 throw해야
 * AuthGuard가 code를 보고 "정지/탈퇴" 안내로 분기할 수 있다.
 * 그 외(만료/미보유 등) 일반 실패는 기존처럼 null로 흡수해 조용히 재로그인 처리를 유지해야 한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPost = vi.fn();
vi.mock('@/api/client', () => ({
  apiClient: { post: (...args: unknown[]) => mockPost(...args) },
}));

import { refreshSession } from '@/api/auth';

describe('refreshSession — 정지/탈퇴 계정은 throw, 그 외 실패는 null(기존 동작 유지)', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('성공 시 AuthResponse를 그대로 반환한다', async () => {
    mockPost.mockResolvedValue({
      data: { accessToken: 'tok', user: { id: '1', email: 'a@a.com', nickname: '닉네임', role: 'user' } },
    });

    const res = await refreshSession();

    expect(res?.accessToken).toBe('tok');
    expect(res?.user.email).toBe('a@a.com');
  });

  it('AUTH_ACCOUNT_SUSPENDED 실패 시 에러를 삼키지 않고 그대로 throw한다', async () => {
    mockPost.mockRejectedValue({ response: { data: { code: 'AUTH_ACCOUNT_SUSPENDED' } } });

    await expect(refreshSession()).rejects.toMatchObject({
      response: { data: { code: 'AUTH_ACCOUNT_SUSPENDED' } },
    });
  });

  it('AUTH_ACCOUNT_DELETED 실패 시 에러를 삼키지 않고 그대로 throw한다', async () => {
    mockPost.mockRejectedValue({ response: { data: { code: 'AUTH_ACCOUNT_DELETED' } } });

    await expect(refreshSession()).rejects.toMatchObject({
      response: { data: { code: 'AUTH_ACCOUNT_DELETED' } },
    });
  });

  it('그 외 code(예: 토큰 만료/무효)의 실패는 기존처럼 null을 반환한다 — 회귀 방지', async () => {
    mockPost.mockRejectedValue({ response: { data: { code: 'AUTH_TOKEN_INVALID' } } });

    await expect(refreshSession()).resolves.toBeNull();
  });

  it('code 필드가 없는 실패(네트워크 에러 등)도 null을 반환한다 — 회귀 방지', async () => {
    mockPost.mockRejectedValue(new Error('network error'));

    await expect(refreshSession()).resolves.toBeNull();
  });
});

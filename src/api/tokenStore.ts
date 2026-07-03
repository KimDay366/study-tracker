/**
 * Access token 메모리 저장소.
 * localStorage 저장 금지 — 새로고침 시 /auth/refresh로 복구한다.
 */

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

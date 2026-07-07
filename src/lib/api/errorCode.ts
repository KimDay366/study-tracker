/**
 * axios 에러 응답에서 서버가 내려준 code 필드를 추출한다.
 * Login.tsx의 로그인/회원가입 에러 분기, auth.ts의 refresh 실패 분기,
 * AuthGuard.tsx의 refresh 실패 리다이렉트 분기가 모두 이 파서를 공유한다.
 */
export function getApiErrorCode(e: unknown): string | undefined {
  const err = e as { response?: { data?: { code?: string } } };
  return err?.response?.data?.code;
}

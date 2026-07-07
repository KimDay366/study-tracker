import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { refreshSession } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';
import { clearSessionAndCache } from '@/lib/storage/clearLocalData';
import { getApiErrorCode } from '@/lib/api/errorCode';
import { queryClient } from '@/App';

// refreshSession이 throw하는 code → Login 화면 쿼리파라미터 매핑 (Login.tsx의 error 분기와 맞춤)
const REFRESH_ERROR_PARAM: Record<string, string> = {
  AUTH_ACCOUNT_SUSPENDED: 'account_suspended',
  AUTH_ACCOUNT_DELETED: 'account_deleted',
};

/**
 * 보호 라우트 가드.
 * 최초 마운트 시 refresh 쿠키로 세션 복구를 시도한다.
 * - 성공 → authenticated, 자식 라우트 렌더
 * - 일반 실패(null 반환) → unauthenticated, /login으로 조용히 리다이렉트
 * - 정지/탈퇴 계정(throw) → unauthenticated, /login?error=... 로 사유를 안내하며 리다이렉트
 */
export function AuthGuard() {
  const navigate = useNavigate();
  const { status, setAuthenticated, setUnauthenticated, setLoading } = useAuthStore();

  useEffect(() => {
    if (status !== 'idle') return;

    setLoading();
    refreshSession()
      .then((res) => {
        if (res) {
          setAuthenticated(res.user);
        } else {
          clearSessionAndCache(queryClient);
          setUnauthenticated();
          navigate('/login', { replace: true });
        }
      })
      .catch((err) => {
        clearSessionAndCache(queryClient);
        setUnauthenticated();
        const code = getApiErrorCode(err);
        const errorParam = code ? REFRESH_ERROR_PARAM[code] : undefined;
        navigate(errorParam ? `/login?error=${errorParam}` : '/login', { replace: true });
      });
  }, [status, setAuthenticated, setUnauthenticated, setLoading, navigate]);

  if (status === 'idle' || status === 'loading') {
    return null; // 세션 확인 중 빈 화면 (스피너 추가는 디자인 2단계에서)
  }

  if (status === 'unauthenticated') {
    return null; // navigate 트리거됨
  }

  return <Outlet />;
}

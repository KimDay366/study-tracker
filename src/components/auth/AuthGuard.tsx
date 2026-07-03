import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { refreshSession } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';
import { clearSessionAndCache } from '@/lib/storage/clearLocalData';
import { queryClient } from '@/App';

/**
 * 보호 라우트 가드.
 * 최초 마운트 시 refresh 쿠키로 세션 복구를 시도한다.
 * - 성공 → authenticated, 자식 라우트 렌더
 * - 실패 → unauthenticated, /login으로 리다이렉트
 */
export function AuthGuard() {
  const navigate = useNavigate();
  const { status, setAuthenticated, setUnauthenticated, setLoading } = useAuthStore();

  useEffect(() => {
    if (status !== 'idle') return;

    setLoading();
    refreshSession().then((res) => {
      if (res) {
        setAuthenticated(res.user);
      } else {
        clearSessionAndCache(queryClient);
        setUnauthenticated();
        navigate('/login', { replace: true });
      }
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

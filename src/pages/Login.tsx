import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login, signup, resendVerification } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';
import { clearSessionAndCache } from '@/lib/storage/clearLocalData';
import { getApiErrorCode } from '@/lib/api/errorCode';
import { queryClient } from '@/App';
import styles from './Login.module.css';

type Tab = 'login' | 'signup';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000/api/v1';

function handleGoogleLogin() {
  // 백엔드 리다이렉트 방식 — 구글 인증 후 백엔드 콜백이 홈으로 되돌려보냄
  window.location.href = `${API_BASE}/auth/google`;
}

function getApiErrorMessage(e: unknown): string {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message ?? err?.message ?? '오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuthenticated = useAuthStore(s => s.setAuthenticated);
  const [tab, setTab] = useState<Tab>('login');
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [signupSuccessEmail, setSignupSuccessEmail] = useState('');
  // 로그인 시 이메일 미인증 상태 — 재발송 버튼 표시용
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  // 로그인 폼
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // 회원가입 폼
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupNickname, setSignupNickname] = useState('');

  function switchTab(next: Tab) {
    setTab(next);
    setGlobalError('');
    setUnverifiedEmail('');
    setResendMessage('');
  }

  // 리다이렉트 후 쿼리파라미터로 전달되는 에러 안내
  // - error=google_unverified: 구글 로그인 시도한 계정이 이메일 미인증 로컬 계정이라 자동연동 거부
  // - error=google: 그 외 구글 로그인 일반 실패
  // - error=account_suspended / account_deleted: 정지/탈퇴 계정으로 판명되어 리다이렉트됨
  //   (refresh 세션 복구 실패 시 AuthGuard가 보내거나, 구글 로그인 콜백에서 백엔드가 직접 보냄 — 파라미터 규격 동일)
  useEffect(() => {
    const errorCode = searchParams.get('error');
    if (errorCode === 'google_unverified') {
      setGlobalError('이미 이메일로 가입된 계정이에요. 이메일 인증을 먼저 완료한 뒤 구글 로그인을 연결해 주세요.');
    } else if (errorCode === 'google') {
      setGlobalError('구글 로그인에 실패했어요. 다시 시도해 주세요.');
    } else if (errorCode === 'account_suspended') {
      setGlobalError('정지된 계정이에요. 고객센터에 문의해 주세요.');
    } else if (errorCode === 'account_deleted') {
      setGlobalError('탈퇴 처리된 계정이에요.');
    }
  }, [searchParams]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError('');
    setUnverifiedEmail('');
    setResendMessage('');
    setLoading(true);
    try {
      const res = await login({ email: loginEmail, password: loginPassword });
      clearSessionAndCache(queryClient);
      setAuthenticated(res.user);
      navigate('/', { replace: true });
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === 'AUTH_EMAIL_NOT_VERIFIED') {
        setGlobalError('이메일 인증이 완료되지 않았어요. 메일함을 확인해 주세요.');
        setUnverifiedEmail(loginEmail);
      } else if (code === 'AUTH_INVALID_CREDENTIALS') {
        // 계정 존재 여부를 노출하지 않도록 이메일 불일치/비밀번호 불일치를 구분하지 않는다(보안 의도).
        setGlobalError('이메일 또는 비밀번호가 올바르지 않아요.');
      } else if (code === 'AUTH_ACCOUNT_SUSPENDED') {
        setGlobalError('정지된 계정이에요. 고객센터에 문의해 주세요.');
      } else if (code === 'AUTH_ACCOUNT_DELETED') {
        setGlobalError('탈퇴 처리된 계정이에요.');
      } else if (code === 'AUTH_RATE_LIMITED') {
        setGlobalError('요청이 너무 많아요. 잠시 후 다시 시도해 주세요.');
      } else {
        setGlobalError(getApiErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError('');
    setLoading(true);
    try {
      await signup({
        email: signupEmail,
        password: signupPassword,
        name: signupName,
        nickname: signupNickname,
      });
      // 가입 성공: 로그인 탭으로 전환, 이메일 미리 채우기
      setSignupSuccessEmail(signupEmail);
      setLoginEmail(signupEmail);
      switchTab('login');
    } catch (err) {
      setGlobalError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!unverifiedEmail) return;
    setResendLoading(true);
    setResendMessage('');
    try {
      await resendVerification(unverifiedEmail);
      setResendMessage('인증 메일을 재발송했어요. 이메일함을 확인해 주세요.');
    } catch {
      setResendMessage('재발송에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoTitle}>스터디 트래커</div>
          <div className={styles.logoSub}>꾸준함이 실력이 됩니다</div>
        </div>

        <div className={styles.tabRow} role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'login'}
            className={`${styles.tab}${tab === 'login' ? ` ${styles.active}` : ''}`}
            onClick={() => switchTab('login')}
          >
            로그인
          </button>
          <button
            role="tab"
            aria-selected={tab === 'signup'}
            className={`${styles.tab}${tab === 'signup' ? ` ${styles.active}` : ''}`}
            onClick={() => switchTab('signup')}
          >
            회원가입
          </button>
        </div>

        {/* 회원가입 성공 안내 */}
        {signupSuccessEmail && tab === 'login' && (
          <div className={styles.successBanner} role="status">
            가입이 완료되었습니다. <strong>{signupSuccessEmail}</strong>로 발송된 인증 링크를 클릭한 후 로그인해 주세요.
            (로컬 개발 환경에서는 백엔드 콘솔 로그를 확인하세요.)
          </div>
        )}

        {globalError && (
          <div className={styles.globalError} role="alert">
            {globalError}
            {unverifiedEmail && (
              <div className={styles.resendArea}>
                {resendMessage ? (
                  <p className={styles.resendMsg}>{resendMessage}</p>
                ) : (
                  <button
                    type="button"
                    className={styles.resendBtn}
                    onClick={handleResend}
                    disabled={resendLoading}
                  >
                    {resendLoading ? '발송 중...' : '인증 메일 재발송'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'login' ? (
          <form className={styles.form} onSubmit={handleLogin} noValidate>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="login-email">이메일</label>
              <input
                id="login-email"
                className={styles.input}
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
                required
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="login-password">비밀번호</label>
              <input
                id="login-password"
                className={styles.input}
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="비밀번호를 입력해 주세요"
                autoComplete="current-password"
                required
              />
            </div>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading || !loginEmail || !loginPassword}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={handleSignup} noValidate>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="signup-email">이메일</label>
              <input
                id="signup-email"
                className={styles.input}
                type="email"
                value={signupEmail}
                onChange={e => setSignupEmail(e.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
                required
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="signup-name">이름</label>
              <input
                id="signup-name"
                className={styles.input}
                type="text"
                value={signupName}
                onChange={e => setSignupName(e.target.value)}
                placeholder="실명을 입력해 주세요"
                autoComplete="name"
                required
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="signup-nickname">닉네임</label>
              <input
                id="signup-nickname"
                className={styles.input}
                type="text"
                value={signupNickname}
                onChange={e => setSignupNickname(e.target.value)}
                placeholder="2~10자"
                autoComplete="nickname"
                required
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="signup-password">비밀번호</label>
              <input
                id="signup-password"
                className={styles.input}
                type="password"
                value={signupPassword}
                onChange={e => setSignupPassword(e.target.value)}
                placeholder="영문+숫자+특수문자, 8자 이상"
                autoComplete="new-password"
                required
              />
            </div>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading || !signupEmail || !signupPassword || !signupName || !signupNickname}
            >
              {loading ? '가입 중...' : '가입하기'}
            </button>
          </form>
        )}

        <div className={styles.divider}>
          <span>또는</span>
        </div>

        <button
          type="button"
          className={styles.googleBtn}
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <svg className={styles.googleIcon} viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
          </svg>
          구글로 계속하기
        </button>
      </div>
    </div>
  );
}

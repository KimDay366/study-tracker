import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, signup, resendVerification } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';
import { clearSessionAndCache } from '@/lib/storage/clearLocalData';
import { queryClient } from '@/App';
import styles from './Login.module.css';

type Tab = 'login' | 'signup';

function getApiErrorCode(e: unknown): string | undefined {
  const err = e as { response?: { data?: { code?: string } } };
  return err?.response?.data?.code;
}

function getApiErrorMessage(e: unknown): string {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message ?? err?.message ?? '오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export function Login() {
  const navigate = useNavigate();
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
        setGlobalError('이메일 인증이 완료되지 않았어요. 인증 메일을 확인해 주세요.');
        setUnverifiedEmail(loginEmail);
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
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '@/api/auth';
import styles from './VerifyEmail.module.css';

type Status = 'idle' | 'loading' | 'success' | 'error' | 'no-token';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>(token ? 'loading' : 'no-token');
  // 1회용 토큰이 두 번 POST되면 두 번째가 실패로 표시되므로, 페이지당 한 번만 요청한다.
  // (StrictMode 이중 실행·리마운트 방어. React ref는 리렌더에도 값이 유지된다.)
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    if (requestedRef.current) return;
    requestedRef.current = true;

    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
    // token은 URL에서 한 번 읽으면 바뀌지 않으므로 의존성 배열에 포함
  }, [token]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoTitle}>차곡</div>
          <div className={styles.logoSub}>이메일 인증</div>
        </div>

        {status === 'loading' && (
          <p className={styles.message}>인증 처리 중입니다...</p>
        )}

        {status === 'success' && (
          <div className={styles.successBox} role="status">
            <p className={styles.successText}>이메일 인증이 완료되었습니다.</p>
            <p className={styles.subText}>이제 로그인할 수 있어요.</p>
            <Link to="/login" className={styles.actionBtn}>로그인 화면으로</Link>
          </div>
        )}

        {status === 'error' && (
          <div className={styles.errorBox} role="alert">
            <p className={styles.errorText}>인증 링크를 확인할 수 없어요.</p>
            <p className={styles.subText}>
              이미 인증을 마치셨다면 그대로 로그인하실 수 있어요.
            </p>
            <p className={styles.subText}>
              링크가 만료됐거나 처음 인증이라면, 로그인 화면에서 인증 메일을 다시 받아 주세요.
            </p>
            <Link to="/login" className={styles.actionBtn}>로그인 화면으로</Link>
          </div>
        )}

        {status === 'no-token' && (
          <div className={styles.errorBox} role="alert">
            <p className={styles.errorText}>유효하지 않은 접근이에요.</p>
            <p className={styles.subText}>이메일에 포함된 인증 링크를 그대로 클릭해 주세요.</p>
            <Link to="/login" className={styles.actionBtn}>로그인 화면으로</Link>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useCallback } from 'react';
import { Dialog } from '@/components/common/Dialog';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { logout } from '@/api/auth';
import { useSettings } from '@/hooks/query/useSettings';
import { useAddSession } from '@/hooks/query/useDailyRecords';
import { flushFailedSessions } from '@/stores/timerStore';
import { DATA_FORMAT_VERSION } from '@/types';
import { QUOTES } from '@/lib/quotes';
import { clearSessionAndCache } from '@/lib/storage/clearLocalData';
import { queryClient } from '@/App';
import styles from './Settings.module.css';

const APP_VERSION = '1.0.0';

// ==============================
// 데이터 내보내기 (localStorage 레거시 지원)
// ==============================
function exportAllData(): void {
  const data: Record<string, unknown> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('st_')) {
        const raw = localStorage.getItem(key);
        try { data[key] = raw ? JSON.parse(raw) : null; } catch { data[key] = raw; }
      }
    }
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    throw new Error('EXPORT_FAILED');
  }
}

type ResetStep = 'idle' | 'step1' | 'step2';

export function Settings() {
  const showToast = useUIStore(s => s.showToast);
  const setUnauthenticated = useAuthStore(s => s.setUnauthenticated);

  const { data: serverSettings } = useSettings();
  const addSessionMutation = useAddSession();

  const [resetStep, setResetStep] = useState<ResetStep>('idle');
  const [loggingOut, setLoggingOut] = useState(false);

  const firstLaunch = serverSettings?.firstLaunchDate ?? null;

  const handleExport = useCallback(() => {
    try {
      exportAllData();
      showToast('데이터를 내보냈어요.', 'success');
    } catch {
      showToast('내보내기 중 오류가 발생했어요.', 'danger');
    }
  }, [showToast]);

  const handleResetConfirm = useCallback(() => {
    // localStorage 레거시 데이터 초기화
    const keys = Object.keys(localStorage).filter(k => k.startsWith('st_'));
    keys.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('st_today_ui');
    setResetStep('idle');
    showToast('모든 데이터가 초기화됐어요.', 'success');
    setTimeout(() => window.location.reload(), 1500);
  }, [showToast]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      // clearSessionAndCache가 st_ 접두사 스토리지를 통째로 비우는데, 여기엔 자정분리·수동정지
      // 저장 실패로 쌓인 미복구 세션 큐(st_failed_sessions)도 포함된다. 지우기 전에 조용히
      // 한 번 더 재전송을 시도해(best-effort) 유실 창을 최소화한다 — 실패해도 로그아웃은 그대로 진행.
      await flushFailedSessions((date, body) => addSessionMutation.mutateAsync({ date, body }));
      await logout();
      clearSessionAndCache(queryClient);
      setUnauthenticated();
      window.location.href = '/login';
    } catch {
      showToast('로그아웃 중 오류가 발생했어요.', 'danger');
    } finally {
      setLoggingOut(false);
    }
  }, [showToast, setUnauthenticated, addSessionMutation]);

  return (
    <div>
      <h1 className={styles.pageTitle}>설정</h1>

      <div className={styles.contentInner}>

        {/* 데이터 저장 안내 */}
        <div className={styles.settingsCard}>
          <div className={styles.settingsCardHeader}>데이터 저장 안내</div>
          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLeft}>
              <div className={styles.settingsRowLabel}>저장 방식</div>
              <div className={styles.settingsRowDesc}>
                데이터는 서버에 안전하게 저장돼요. 어떤 기기에서 접속해도 동일한 데이터를 볼 수 있어요.
              </div>
            </div>
            <span style={{ fontSize: '28px' }}>☁️</span>
          </div>
        </div>

        {/* 데이터 관리 */}
        <div className={styles.settingsCard}>
          <div className={styles.settingsCardHeader}>데이터 관리</div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLeft}>
              <div className={styles.settingsRowLabel}>데이터 내보내기</div>
              <div className={styles.settingsRowDesc}>
                로컬에 남아 있는 기존 데이터를 JSON 파일로 저장해요.
              </div>
            </div>
            <button type="button" className={styles.btnSecondary} onClick={handleExport}>
              JSON 내보내기
            </button>
          </div>

          <div className={`${styles.settingsRow} ${styles.settingsRowColumn}`}>
            <div className={styles.settingsRowLeft}>
              <div className={`${styles.settingsRowLabel} ${styles.settingsRowLabelDanger}`}>
                모든 데이터 초기화
              </div>
              <div className={styles.settingsRowDesc}>
                로컬 캐시 데이터를 초기화해요. <strong>이 작업은 되돌릴 수 없어요.</strong>
              </div>
            </div>
            <button type="button" className={styles.btnDanger} onClick={() => setResetStep('step1')}>
              모든 데이터 초기화
            </button>
          </div>
        </div>

        {/* 계정 */}
        <div className={styles.settingsCard}>
          <div className={styles.settingsCardHeader}>계정</div>
          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLeft}>
              <div className={styles.settingsRowLabel}>로그아웃</div>
              <div className={styles.settingsRowDesc}>현재 기기에서 로그아웃해요.</div>
            </div>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? '처리 중...' : '로그아웃'}
            </button>
          </div>
        </div>

        {/* 앱 정보 */}
        <div className={styles.settingsCard}>
          <div className={styles.settingsCardHeader}>앱 정보</div>
          <div className={styles.appInfoRow}>
            <span className={styles.appInfoKey}>버전</span>
            <span className={styles.appInfoValue}>v{APP_VERSION}</span>
          </div>
          <div className={styles.appInfoRow}>
            <span className={styles.appInfoKey}>데이터 포맷</span>
            <span className={styles.appInfoValue}>{DATA_FORMAT_VERSION}</span>
          </div>
          <div className={styles.appInfoRow}>
            <span className={styles.appInfoKey}>명언 출처</span>
            <span className={styles.appInfoValue} style={{ fontFamily: 'var(--font-family-base)' }}>
              내장 명언 {QUOTES.length}개 · 저작권 만료 인용
            </span>
          </div>
          {firstLaunch && (
            <div className={styles.appInfoRow}>
              <span className={styles.appInfoKey}>첫 접속일</span>
              <span className={styles.appInfoValue}>{firstLaunch}</span>
            </div>
          )}
          <div className={styles.appInfoRow}>
            <span className={styles.appInfoKey}>저작권</span>
            <span
              className={styles.appInfoValue}
              style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
            >
              © 2026 스터디 트래커
            </span>
          </div>
        </div>

      </div>

      {resetStep === 'step1' && (
        <Dialog
          icon="🗑"
          title="데이터를 초기화할까요?"
          description="로컬 캐시 데이터가 삭제돼요. 계속하시겠어요?"
          cancelLabel="취소"
          confirmLabel="계속하기"
          confirmVariant="danger"
          onCancel={() => setResetStep('idle')}
          onConfirm={() => setResetStep('step2')}
        />
      )}

      {resetStep === 'step2' && (
        <Dialog
          icon="⚠️"
          title="정말 삭제할까요?"
          description="복구할 수 없어요. 정말로 초기화하시겠어요?"
          cancelLabel="취소"
          confirmLabel="모두 삭제"
          confirmVariant="danger"
          onCancel={() => setResetStep('idle')}
          onConfirm={handleResetConfirm}
        />
      )}
    </div>
  );
}

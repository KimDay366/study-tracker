import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useUIStore } from '@/stores/uiStore';
import { consumeStorageCorruption } from '@/lib/storage';
import { useSettings, usePatchSettings } from '@/hooks/query/useSettings';
import { getLocalDateString } from '@/lib/calculator/timer';
import { Dialog } from '@/components/common/Dialog';
import { SideNav } from './SideNav';
import { BottomNav } from './BottomNav';
import styles from './AppShell.module.css';

interface Props {
  children: React.ReactNode;
}

export function AppShell({ children }: Props) {
  const isPC = useMediaQuery('(min-width: 1200px)');
  const location = useLocation();
  const isPrivateMode = useUIStore(s => s.isPrivateMode);
  const showToast = useUIStore(s => s.showToast);

  // 손상된 데이터가 감지됐으면 마운트 후 1회 안내
  useEffect(() => {
    if (consumeStorageCorruption()) {
      showToast('일부 데이터를 불러오지 못했어요. 손상된 데이터가 있을 수 있어요.', 'warning');
    }
  }, [showToast]);

  // 첫 접속 안내 모달 (D-7) — 서버 설정 기준
  const { data: settings } = useSettings();
  const patchSettings = usePatchSettings();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const showOnboarding = !onboardingDismissed && settings != null && !settings.hasSeenOnboarding;

  const handleOnboardingClose = () => {
    patchSettings.mutate({
      hasSeenOnboarding: true,
      firstLaunchDate: settings?.firstLaunchDate ?? getLocalDateString(),
    });
    setOnboardingDismissed(true);
  };

  // SCR-03 로직 편집: 모바일/태블릿은 셸(SideNav/BottomNav) 미적용, PC(1200px+)는 SideNav와 공존
  const isLogicEditPage = location.pathname.startsWith('/logics/') || location.pathname === '/logics/new';

  const onboardingDialog = showOnboarding && (
    <Dialog
      icon="👋"
      title="시작하기 전에 알려드려요"
      description="기록은 서버에 안전하게 저장돼요. 로그인만 하면 어느 기기에서나 이어서 볼 수 있어요. 꾸준히 기록해 보세요!"
      confirmLabel="시작하기"
      hideCancel
      onCancel={handleOnboardingClose}
      onConfirm={handleOnboardingClose}
    />
  );

  // 모바일/태블릿에서는 로직 편집이 여전히 셸 없는 집중 화면 (기존 동작 유지)
  if (isLogicEditPage && !isPC) {
    return <>{onboardingDialog}{children}</>;
  }

  return (
    <div className={styles.appShell}>
      {onboardingDialog}
      {isPC && <SideNav />}
      <div className={styles.mainArea}>
        {isPrivateMode && (
          <div className={styles.privateBanner} role="alert">
            <span>⚠️</span>
            <span>
              <strong>개인정보 보호 모드</strong>에서 실행 중이에요.
              브라우저를 닫으면 로그인이 풀릴 수 있어요. 기록 자체는 서버에 안전하게 저장돼요.
            </span>
          </div>
        )}
        {/* 로직 편집 페이지(PC): 자체 앱바가 edge-to-edge로 보이도록 mainContent의 기본 패딩을 제거 */}
        <main className={`${styles.mainContent}${isLogicEditPage ? ` ${styles.mainContentFlush}` : ''}`}>
          {children}
        </main>
        {!isPC && <BottomNav />}
      </div>
    </div>
  );
}

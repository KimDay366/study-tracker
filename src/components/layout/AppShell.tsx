import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useUIStore } from '@/stores/uiStore';
import { appSettingsRepo, consumeStorageCorruption } from '@/lib/storage';
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

  // 첫 접속 데이터 안내 모달 (D-7)
  const [showOnboarding, setShowOnboarding] = useState(
    () => !appSettingsRepo.get().hasSeenOnboarding,
  );
  const handleOnboardingClose = () => {
    const settings = appSettingsRepo.get();
    appSettingsRepo.save({
      ...settings,
      hasSeenOnboarding: true,
      firstLaunchDate: settings.firstLaunchDate ?? getLocalDateString(),
      updatedAt: new Date().toISOString(),
    });
    setShowOnboarding(false);
  };

  // SCR-03 로직 편집은 셸 미적용
  const isLogicEditPage = location.pathname.startsWith('/logics/') || location.pathname === '/logics/new';

  const onboardingDialog = showOnboarding && (
    <Dialog
      icon="👋"
      title="시작하기 전에 알려드려요"
      description="기록한 데이터는 이 기기의 브라우저에만 저장돼요. 다른 기기와 동기화되지 않으며, 브라우저 데이터를 지우면 기록도 사라질 수 있어요. 가끔 설정에서 데이터를 내보내 백업해 주세요."
      confirmLabel="시작하기"
      hideCancel
      onCancel={handleOnboardingClose}
      onConfirm={handleOnboardingClose}
    />
  );

  if (isLogicEditPage) {
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
              브라우저 세션이 종료되면 데이터가 사라질 수 있어요. 일반 탭에서 사용해 주세요.
            </span>
          </div>
        )}
        <main className={styles.mainContent}>
          {children}
        </main>
        {!isPC && <BottomNav />}
      </div>
    </div>
  );
}

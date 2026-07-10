import type { SVGProps } from 'react';
import { NavLink } from 'react-router-dom';
import { useWeeklyReviewBadge } from '@/hooks/useWeeklyReviewBadge';
import styles from './SideNav.module.css';

type IconProps = SVGProps<SVGSVGElement>;

function IconHome(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 9.5 12 3l9 6.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

function IconCalendar(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function IconReview(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6H8Z" />
      <path d="M14 3v5a1 1 0 0 0 1 1h5" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
}

function IconPlan(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M8 12.5 10.5 15 16 9" />
    </svg>
  );
}

function IconRoutine(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 4v5h5" />
      <path d="M20 20v-5h-5" />
      <path d="M4.5 15a8 8 0 0 0 14.9 3.4M19.5 9A8 8 0 0 0 4.6 5.6" />
    </svg>
  );
}

function IconSettings(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 5 15a1.65 1.65 0 0 0-1-1.51H4a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 5 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.44 4.3l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15Z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { path: '/', label: '오늘의 플랜', Icon: IconHome },
  { path: '/calendar', label: '달력', Icon: IconCalendar },
  { path: '/weekly-review', label: '주간 정리', Icon: IconReview },
  { path: '/logics', label: '플랜 관리', Icon: IconPlan },
  { path: '/routine', label: '루틴 설정', Icon: IconRoutine },
  { path: '/settings', label: '설정', Icon: IconSettings },
] as const;

export function SideNav() {
  const showReviewBadge = useWeeklyReviewBadge();
  return (
    <nav className={styles.sideNav}>
      <div className={styles.logo}>차곡</div>
      <ul className={styles.navList}>
        {NAV_ITEMS.map(({ path, label, Icon }) => (
          <li key={path} className={styles.navItem}>
            <NavLink
              to={path}
              end={path === '/'}
              className={({ isActive }) => isActive ? styles.active : undefined}
            >
              <Icon className={styles.navIcon} aria-hidden="true" />
              <span className={styles.navLabel}>
                {label}
                {path === '/weekly-review' && showReviewBadge && (
                  <span className={styles.navBadge}>이번 주 정리를 작성해 보세요!</span>
                )}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

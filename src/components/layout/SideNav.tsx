import { NavLink } from 'react-router-dom';
import { useWeeklyReviewBadge } from '@/hooks/useWeeklyReviewBadge';
import styles from './SideNav.module.css';

const NAV_ITEMS = [
  { path: '/', label: '오늘의 공부' },
  { path: '/calendar', label: '달력' },
  { path: '/weekly-review', label: '주간 정리' },
  { path: '/logics', label: '플랜 관리' },
  { path: '/routine', label: '루틴 설정' },
  { path: '/settings', label: '설정' },
] as const;

export function SideNav() {
  const showReviewBadge = useWeeklyReviewBadge();
  return (
    <nav className={styles.sideNav}>
      <div className={styles.logo}>스터디 트래커</div>
      <ul className={styles.navList}>
        {NAV_ITEMS.map(({ path, label }) => (
          <li key={path} className={styles.navItem}>
            <NavLink
              to={path}
              end={path === '/'}
              className={({ isActive }) => isActive ? styles.active : undefined}
            >
              {label}
              {path === '/weekly-review' && showReviewBadge && (
                <span className={styles.navBadge}>이번 주 정리를 작성해 보세요!</span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

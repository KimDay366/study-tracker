import { NavLink } from 'react-router-dom';
import { useWeeklyReviewBadge } from '@/hooks/useWeeklyReviewBadge';
import styles from './BottomNav.module.css';

const NAV_ITEMS = [
  { path: '/', label: '오늘' },
  { path: '/calendar', label: '달력' },
  { path: '/weekly-review', label: '회고' },
  { path: '/logics', label: '로직' },
  { path: '/settings', label: '설정' },
] as const;

export function BottomNav() {
  const showReviewBadge = useWeeklyReviewBadge();
  return (
    <nav className={styles.bottomNav}>
      {NAV_ITEMS.map(({ path, label }) => (
        <div key={path} className={styles.navItem}>
          <NavLink
            to={path}
            end={path === '/'}
            className={({ isActive }) => isActive ? styles.active : undefined}
          >
            <span>
              {label}
              {path === '/weekly-review' && showReviewBadge && (
                <span className={styles.navBadge} aria-label="이번 주 회고를 작성해 보세요!" />
              )}
            </span>
          </NavLink>
        </div>
      ))}
    </nav>
  );
}

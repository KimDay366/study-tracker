import styles from './HeartDisplay.module.css';
import { calcFilledHearts } from '@/lib/calculator/achievement';

interface Props {
  achievementPercent: number;
  colorVar?: string; // '--cat-color-XX'
  rainbow?: boolean;
  size?: number;
}

export function HeartDisplay({ achievementPercent, colorVar, rainbow = false, size = 10 }: Props) {
  const filled = calcFilledHearts(achievementPercent);

  return (
    <div className={styles.container} aria-label={`달성률 ${achievementPercent}%`}>
      {Array.from({ length: size }, (_, i) => {
        const isFilled = i < filled;

        if (rainbow && isFilled) {
          return (
            <span key={i} className={`${styles.heart} ${styles.rainbow}`}>♥</span>
          );
        }

        if (isFilled) {
          return (
            <span
              key={i}
              className={styles.heart}
              style={colorVar ? { color: `var(${colorVar})` } : undefined}
            >
              ♥
            </span>
          );
        }

        return (
          <span key={i} className={`${styles.heart} ${styles.heartEmpty}`}>♥</span>
        );
      })}
    </div>
  );
}

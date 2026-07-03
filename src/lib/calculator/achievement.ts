/**
 * 달성률(%) 계산 — 소수 1자리 반올림
 */
export function calcAchievementPercent(
  actualMinutes: number,
  targetMinutes: number,
): number {
  if (targetMinutes <= 0) return 0;
  return Math.round((actualMinutes / targetMinutes) * 1000) / 10;
}

/**
 * 채워진 하트 수 계산 (최대 10)
 * 달성률 10% 당 하트 1개(이분법), 100% 초과도 최대 10개
 */
export function calcFilledHearts(achievementPercent: number): number {
  return Math.min(10, Math.floor(achievementPercent / 10));
}

/**
 * @deprecated 이분법 정책(D-3)으로 반개 하트 제거. 항상 false 반환.
 * HeartDisplay 참조가 남아 있는 동안 하위 호환용으로만 유지.
 */
export function calcHalfHeart(_achievementPercent: number): boolean {
  return false;
}

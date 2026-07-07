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
 * 캡-평균 달성률(%) 계산 — 각 값을 100%로 캡한 뒤 평균, 소수 1자리 반올림.
 * 예) [50, 120, 60] → (50+100+60)/3 = 70
 * 초과 달성(120%)의 초과분이 미달 로직을 상쇄해 부풀리는 걸 막기 위해,
 * 날짜/월간처럼 "여러 로직을 종합"하는 곳에서 사용한다(개별 로직/카테고리 달성률에는 쓰지 않음).
 * 빈 배열이면 0.
 */
export function capAveragePercent(percents: number[]): number {
  if (percents.length === 0) return 0;
  const capped = percents.map((p) => Math.min(100, p));
  const avg = capped.reduce((sum, p) => sum + p, 0) / capped.length;
  return Math.round(avg * 10) / 10;
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

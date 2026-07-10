/**
 * 방향① — 활동별 분(minutes)으로 전체 합산 및 퍼센트 계산
 * @returns { totalMinutes, percents } percents는 categoryId 순서대로
 */
export function calcFromCategoryMinutes(
  categoryMinutes: number[],
): { totalMinutes: number; percents: number[] } {
  const totalMinutes = categoryMinutes.reduce((a, b) => a + b, 0);
  if (totalMinutes === 0) {
    return { totalMinutes: 0, percents: categoryMinutes.map(() => 0) };
  }
  // 마지막 활동에 잔여 퍼센트 배분 (부동소수점 오차 방지)
  const percents: number[] = [];
  let sumPercent = 0;
  for (let i = 0; i < categoryMinutes.length; i++) {
    if (i === categoryMinutes.length - 1) {
      const last = Math.round((100 - sumPercent) * 10) / 10;
      percents.push(last);
    } else {
      const p = Math.round((categoryMinutes[i] / totalMinutes) * 1000) / 10;
      percents.push(p);
      sumPercent += p;
    }
  }
  return { totalMinutes, percents };
}

/**
 * 방향② — 전체 분과 퍼센트 배열로 활동별 분 계산
 * 잔여 분은 마지막 활동에 배분, 최소 1분 보장
 */
export function calcFromTotalMinutes(
  totalMinutes: number,
  percents: number[],
): number[] {
  if (percents.length === 0) return [];
  const minutes: number[] = [];
  let sumMinutes = 0;
  for (let i = 0; i < percents.length; i++) {
    if (i === percents.length - 1) {
      const last = Math.max(1, totalMinutes - sumMinutes);
      minutes.push(last);
    } else {
      const m = Math.max(1, Math.floor((totalMinutes * percents[i]) / 100));
      minutes.push(m);
      sumMinutes += m;
    }
  }
  return minutes;
}

/**
 * 퍼센트 합계 유효성 검사 (99.9% ~ 100.0% 허용, 부동소수점 오차 0.05% 감안)
 */
export function isPercentSumValid(percents: number[]): boolean {
  const sum = percents.reduce((a, b) => a + b, 0);
  return sum >= 99.85 && sum <= 100.05;
}

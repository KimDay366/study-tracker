import { describe, it, expect } from 'vitest';
import {
  calcFromCategoryMinutes,
  calcFromTotalMinutes,
  isPercentSumValid,
} from '@/lib/calculator/biDirectional';

describe('calcFromCategoryMinutes (방향①)', () => {
  it('3개 활동 → 합산 및 퍼센트', () => {
    const { totalMinutes, percents } = calcFromCategoryMinutes([60, 30, 10]);
    expect(totalMinutes).toBe(100);
    // 퍼센트 합은 100이어야 함
    const sum = percents.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.1);
  });

  it('단일 활동 → 100%', () => {
    const { totalMinutes, percents } = calcFromCategoryMinutes([120]);
    expect(totalMinutes).toBe(120);
    expect(percents[0]).toBe(100);
  });

  it('모두 0분 → totalMinutes 0, 퍼센트 0', () => {
    const { totalMinutes, percents } = calcFromCategoryMinutes([0, 0]);
    expect(totalMinutes).toBe(0);
    expect(percents).toEqual([0, 0]);
  });
});

describe('calcFromTotalMinutes (방향②)', () => {
  it('총 100분, [50%, 30%, 20%] → 분 배분', () => {
    const result = calcFromTotalMinutes(100, [50, 30, 20]);
    expect(result).toEqual([50, 30, 20]);
  });

  it('마지막 활동에 잔여 배분', () => {
    // 100분, [33.3%, 33.3%, 33.4%] — 소수점 계산 오차 처리
    const result = calcFromTotalMinutes(100, [33.3, 33.3, 33.4]);
    const sum = result.reduce((a, b) => a + b, 0);
    expect(sum).toBe(100); // 합이 정확히 100분
  });

  it('최소 1분 보장', () => {
    // 1분을 3개로 나누면 각 0.33...분 → 최소 1분 보장
    const result = calcFromTotalMinutes(1, [50, 30, 20]);
    expect(result.every(m => m >= 1)).toBe(true);
  });

  it('빈 배열 → 빈 결과', () => {
    expect(calcFromTotalMinutes(100, [])).toEqual([]);
  });
});

describe('방향① ↔ ② 왕복', () => {
  it('방향①으로 계산된 퍼센트로 방향② 역산 → 원래 분과 같아야 함 (오차 1분 이내)', () => {
    const original = [60, 90, 30];
    const { totalMinutes, percents } = calcFromCategoryMinutes(original);
    const reversed = calcFromTotalMinutes(totalMinutes, percents);
    original.forEach((m, i) => {
      expect(Math.abs(reversed[i] - m)).toBeLessThanOrEqual(1);
    });
  });
});

describe('isPercentSumValid', () => {
  it('정확히 100% → 유효', () => {
    expect(isPercentSumValid([50, 30, 20])).toBe(true);
  });

  it('99.9% → 유효 (경계)', () => {
    expect(isPercentSumValid([33.3, 33.3, 33.3])).toBe(true);
  });

  it('100.0% → 유효', () => {
    expect(isPercentSumValid([100])).toBe(true);
  });

  it('99.8% → 무효 (99.9% 미만)', () => {
    expect(isPercentSumValid([33, 33, 33])).toBe(false);
  });

  it('100.1% 초과 → 무효', () => {
    expect(isPercentSumValid([50, 50, 1])).toBe(false);
  });
});

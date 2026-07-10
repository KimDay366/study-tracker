import { describe, it, expect } from 'vitest';
import {
  calcAchievementPercent,
  calcFilledHearts,
  calcHalfHeart,
  capAveragePercent,
} from '@/lib/calculator/achievement';

describe('calcAchievementPercent', () => {
  it('0분 → 0%', () => {
    expect(calcAchievementPercent(0, 100)).toBe(0);
  });

  it('목표 0분 → 0% (division by zero 방어)', () => {
    expect(calcAchievementPercent(10, 0)).toBe(0);
  });

  it('100% 정확히', () => {
    expect(calcAchievementPercent(60, 60)).toBe(100);
  });

  it('50% 정확히', () => {
    expect(calcAchievementPercent(30, 60)).toBe(50);
  });

  it('100.1% 초과 달성', () => {
    expect(calcAchievementPercent(61, 60)).toBeCloseTo(101.7, 1);
  });

  it('소수 1자리 반올림 — 9.9%', () => {
    expect(calcAchievementPercent(99, 1000)).toBe(9.9);
  });
});

describe('calcFilledHearts', () => {
  it('0% → 하트 0개', () => {
    expect(calcFilledHearts(0)).toBe(0);
  });

  it('9.9% → 하트 0개', () => {
    expect(calcFilledHearts(9.9)).toBe(0);
  });

  it('10% → 하트 1개', () => {
    expect(calcFilledHearts(10)).toBe(1);
  });

  it('100% → 하트 10개', () => {
    expect(calcFilledHearts(100)).toBe(10);
  });

  it('100.1% → 하트 10개 (초과도 최대 10)', () => {
    expect(calcFilledHearts(100.1)).toBe(10);
  });

  it('150% → 하트 10개', () => {
    expect(calcFilledHearts(150)).toBe(10);
  });

  // D-3 이분법: 경계값 확인
  it('정확히 100.0% → 하트 10개 (초과달성 배지 미표시 경계)', () => {
    expect(calcFilledHearts(100)).toBe(10);
  });

  it('50% → 하트 5개', () => {
    expect(calcFilledHearts(50)).toBe(5);
  });

  it('73% → 하트 7개 (10% 이분법, 나머지 버림)', () => {
    expect(calcFilledHearts(73)).toBe(7);
  });
});

describe('capAveragePercent — 여러 플랜 종합(총/월 달성률)용 캡-평균', () => {
  it('50/120/60 → 각 100%로 캡한 뒤 평균 = 70 (초과분이 미달분을 상쇄하지 않음)', () => {
    expect(capAveragePercent([50, 120, 60])).toBe(70);
  });

  it('전부 100% 이상이면 100', () => {
    expect(capAveragePercent([100, 150, 120])).toBe(100);
  });

  it('전부 미달이면 캡 없이 그대로 평균', () => {
    expect(capAveragePercent([50, 30, 40])).toBe(40);
  });

  it('값 1개 — 캡만 적용', () => {
    expect(capAveragePercent([150])).toBe(100);
    expect(capAveragePercent([37.5])).toBe(37.5);
  });

  it('빈 배열 → 0', () => {
    expect(capAveragePercent([])).toBe(0);
  });

  it('소수 1자리 반올림', () => {
    // (50+100+100)/3 = 83.333... → 83.3
    expect(capAveragePercent([50, 100, 120])).toBeCloseTo(83.3, 1);
  });
});

describe('calcHalfHeart — D-3 이분법 정책: 항상 false', () => {
  it('0% → 반개 없음', () => {
    expect(calcHalfHeart(0)).toBe(false);
  });

  it('5% → 반개 없음 (이분법: 반개 하트 제거됨)', () => {
    expect(calcHalfHeart(5)).toBe(false);
  });

  it('15% → 반개 없음 (이분법: 반개 하트 제거됨)', () => {
    expect(calcHalfHeart(15)).toBe(false);
  });

  it('14.9% → 반개 없음', () => {
    expect(calcHalfHeart(14.9)).toBe(false);
  });

  it('100% → 반개 없음 (꽉 채워짐)', () => {
    expect(calcHalfHeart(100)).toBe(false);
  });

  it('105% → 반개 없음 (초과 달성)', () => {
    expect(calcHalfHeart(105)).toBe(false);
  });
});

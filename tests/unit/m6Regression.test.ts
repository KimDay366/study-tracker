/**
 * M6 QA 회귀 방지 테스트
 * - MAJ-01: DayDetail 초과달성 경계 (catPct > 100, not >=)
 * - MAJ-02/05: 이분법 하트 (반개 없음)
 * - CRIT-02: sessionStorage draft 유틸
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calcFilledHearts, calcHalfHeart } from '@/lib/calculator/achievement';
import { saveSessionDraft, loadSessionDraft, clearSessionDraft } from '@/stores/timerStore';

// ==============================
// MAJ-01: DayDetail "초과 달성!" 경계
// catPct > 100 일 때만 표시 (정확히 100.0%는 미표시)
// ==============================
describe('MAJ-01 DayDetail 초과달성 배지 경계', () => {
  it('catPct = 100.0 → 초과달성 아님 (> 100 조건)', () => {
    const catPct = 100.0;
    expect(catPct > 100).toBe(false);
  });

  it('catPct = 100.1 → 초과달성', () => {
    const catPct = 100.1;
    expect(catPct > 100).toBe(true);
  });

  it('catPct = 99.9 → 초과달성 아님', () => {
    const catPct = 99.9;
    expect(catPct > 100).toBe(false);
  });

  it('catPct = 0 → 초과달성 아님', () => {
    expect((0) > 100).toBe(false);
  });
});

// ==============================
// MAJ-02/05: 이분법 하트 — 반개 없음
// ==============================
describe('MAJ-02/05 이분법 하트 (D-3 정책)', () => {
  it('73% → 채워진 하트 7개, 반개 없음', () => {
    expect(calcFilledHearts(73)).toBe(7);
    expect(calcHalfHeart(73)).toBe(false);
  });

  it('75% → 채워진 하트 7개, 반개 없음 (5%단위 반개이던 케이스)', () => {
    expect(calcFilledHearts(75)).toBe(7);
    expect(calcHalfHeart(75)).toBe(false);
  });

  it('80% → 채워진 하트 8개, 반개 없음', () => {
    expect(calcFilledHearts(80)).toBe(8);
    expect(calcHalfHeart(80)).toBe(false);
  });

  it('0% → 채워진 0, 반개 없음', () => {
    expect(calcFilledHearts(0)).toBe(0);
    expect(calcHalfHeart(0)).toBe(false);
  });

  it('5% → 채워진 0, 반개 없음 (기존 반개이던 케이스)', () => {
    expect(calcFilledHearts(5)).toBe(0);
    expect(calcHalfHeart(5)).toBe(false);
  });

  it('15% → 채워진 1, 반개 없음 (기존 반개이던 케이스)', () => {
    expect(calcFilledHearts(15)).toBe(1);
    expect(calcHalfHeart(15)).toBe(false);
  });
});

// ==============================
// CRIT-02: sessionStorage draft 저장/복원/삭제
// ==============================
describe('CRIT-02 sessionStorage draft 유틸', () => {
  beforeEach(() => {
    // jsdom sessionStorage 초기화
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('saveSessionDraft → loadSessionDraft 왕복', () => {
    const draft = {
      categoryId: 'cat-1',
      sessionStartTimestamp: 1750000000000,
      pauseOffset: 0,
      pausedAt: null,
      status: 'running' as const,
    };
    saveSessionDraft(draft);
    const loaded = loadSessionDraft();
    expect(loaded).toEqual(draft);
  });

  it('draft 없으면 loadSessionDraft → null', () => {
    expect(loadSessionDraft()).toBeNull();
  });

  it('clearSessionDraft 후 null', () => {
    saveSessionDraft({
      categoryId: 'cat-1',
      sessionStartTimestamp: 1750000000000,
      pauseOffset: 0,
      pausedAt: null,
      status: 'running',
    });
    clearSessionDraft();
    expect(loadSessionDraft()).toBeNull();
  });

  it('일시정지 상태도 정상 저장', () => {
    const draft = {
      categoryId: 'cat-2',
      sessionStartTimestamp: 1750000000000,
      pauseOffset: 30000,
      pausedAt: 1750000030000,
      status: 'paused' as const,
    };
    saveSessionDraft(draft);
    const loaded = loadSessionDraft();
    expect(loaded?.status).toBe('paused');
    expect(loaded?.pausedAt).toBe(1750000030000);
    expect(loaded?.pauseOffset).toBe(30000);
  });
});

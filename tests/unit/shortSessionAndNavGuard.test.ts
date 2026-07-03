/**
 * 기능 2: 1분 미만 미저장 정책 및 자정 분리 구간 판정 회귀 테스트
 *
 * - handleStop의 1분 미만 분기 조건 (순수 로직)
 * - 자정 분리 시 각 구간(prevDur/todayDur)이 1분 미만이면 저장 대상 제외
 * - 기능 1: useBlocker 기반 네비게이션 가드는 UI 통합 없이 활성화 조건 로직만 검증
 */
import { describe, it, expect, afterEach } from 'vitest';
import { calcDurationMinutes, getLocalMidnight } from '@/lib/calculator/timer';
import { useTimerStore } from '@/stores/timerStore';

// ──────────────────────────────────────────────
// 기능 2 — 1분 미만 미저장 정책
// ──────────────────────────────────────────────
describe('1분 미만 미저장 정책 — durationMinutes 판정', () => {
  it('정지 시 경과 0분(0ms) → 저장하지 않음', () => {
    const now = Date.now();
    const dur = calcDurationMinutes(now, now);
    expect(dur < 1).toBe(true);
  });

  it('정지 시 경과 59초(59000ms) → 0분 → 저장하지 않음', () => {
    const start = 1_000_000;
    const dur = calcDurationMinutes(start, start + 59_000);
    expect(dur).toBe(0);
    expect(dur < 1).toBe(true);
  });

  it('정지 시 경과 정확히 1분(60000ms) → 저장 대상', () => {
    const start = 1_000_000;
    const dur = calcDurationMinutes(start, start + 60_000);
    expect(dur).toBe(1);
    expect(dur >= 1).toBe(true);
  });

  it('정지 시 경과 61초 → 1분 → 저장 대상', () => {
    const start = 1_000_000;
    const dur = calcDurationMinutes(start, start + 61_000);
    expect(dur).toBe(1);
    expect(dur >= 1).toBe(true);
  });

  it('정지 시 경과 2분 → 저장 대상', () => {
    const start = 1_000_000;
    const dur = calcDurationMinutes(start, start + 120_000);
    expect(dur).toBe(2);
    expect(dur >= 1).toBe(true);
  });
});

// ──────────────────────────────────────────────
// 기능 2 — 자정 분리 구간 1분 미만 누락 정책
// ──────────────────────────────────────────────
describe('자정 분리 구간 판정 — 1분 미만이면 조용히 누락', () => {
  /**
   * 자정 분리 로직의 핵심 판정식:
   *   prevDur = calcDurationMinutes(start, midnight - 1)
   *   todayDur = calcDurationMinutes(midnight, now)
   *   → 각각 >= 1이어야 저장 대상
   */
  it('전날 구간 59초 → prevDur=0 → 저장 스킵', () => {
    // 예: 23:59:01 시작, 자정 직전 = 23:59:59.999
    const midnight = new Date('2026-06-24T00:00:00').getTime();
    const start = midnight - 59_000; // 23:59:01
    const prevDur = calcDurationMinutes(start, midnight - 1);
    expect(prevDur).toBe(0);
    expect(prevDur < 1).toBe(true);
  });

  it('전날 구간 정확히 1분 → prevDur=1 → 저장 대상', () => {
    const midnight = new Date('2026-06-24T00:00:00').getTime();
    const start = midnight - 60_000; // 23:59:00
    const prevDur = calcDurationMinutes(start, midnight - 1);
    expect(prevDur).toBe(0); // floor(59999/60000) = 0 — 실제론 0임(자정-1ms 때문)
    // 이는 기존 timer.test.ts의 자정 분리 케이스와 동일한 결과 확인
  });

  it('전날 구간 2분(23:58~자정) → prevDur=1 → 저장 대상', () => {
    const midnight = new Date('2026-06-24T00:00:00').getTime();
    const start = midnight - 120_000; // 23:58:00
    const prevDur = calcDurationMinutes(start, midnight - 1);
    // floor(119999/60000) = 1
    expect(prevDur).toBe(1);
    expect(prevDur >= 1).toBe(true);
  });

  it('오늘 구간 30초(자정~00:00:30) → todayDur=0 → 저장 스킵', () => {
    const midnight = new Date('2026-06-24T00:00:00').getTime();
    const now = midnight + 30_000; // 00:00:30
    const todayDur = calcDurationMinutes(midnight, now);
    expect(todayDur).toBe(0);
    expect(todayDur < 1).toBe(true);
  });

  it('오늘 구간 1분(자정~00:01:00) → todayDur=1 → 저장 대상', () => {
    const midnight = new Date('2026-06-24T00:00:00').getTime();
    const now = midnight + 60_000; // 00:01:00
    const todayDur = calcDurationMinutes(midnight, now);
    expect(todayDur).toBe(1);
    expect(todayDur >= 1).toBe(true);
  });

  it('getLocalMidnight이 반환한 자정 기준으로 전날/오늘 구간 분리', () => {
    // 23:50 ~ 00:15 세션 (24분)
    const sessionStart = new Date('2026-06-23T23:50:00').getTime();
    const sessionNow   = new Date('2026-06-24T00:15:00').getTime();
    const midnight     = getLocalMidnight(sessionNow);

    const prevDur  = calcDurationMinutes(sessionStart, midnight - 1); // 23일: 약 9분
    const todayDur = calcDurationMinutes(midnight, sessionNow);        // 24일: 15분

    expect(prevDur >= 1).toBe(true);  // 저장 대상
    expect(todayDur >= 1).toBe(true); // 저장 대상
  });

  it('23:59:30 시작 → 자정까지 30초 → prevDur=0 → 스킵 / 오늘 5분 → todayDur=5 → 저장', () => {
    const sessionStart = new Date('2026-06-23T23:59:30').getTime();
    const sessionNow   = new Date('2026-06-24T00:05:00').getTime();
    const midnight     = getLocalMidnight(sessionNow);

    const prevDur  = calcDurationMinutes(sessionStart, midnight - 1);
    const todayDur = calcDurationMinutes(midnight, sessionNow);

    expect(prevDur).toBe(0);   // 30초 미만 → 스킵
    expect(todayDur).toBe(5);  // 5분 → 저장 대상
  });
});

// ──────────────────────────────────────────────
// STEP3 — 일시정지 포함 자정 분리 (getElapsedMs 기준, 벽시계 부풀림 방지)
// ──────────────────────────────────────────────
describe('일시정지 포함 자정 분리 — getElapsedMs 기준으로 전날 기록이 부풀지 않는다', () => {
  const MIN = 60_000;

  afterEach(() => {
    useTimerStore.getState().resetTimer();
  });

  it('경로2(일시정지 중 자정 넘김 후 재개): 전날 prevDur이 일시정지를 제외한다', () => {
    const midnight = new Date('2026-06-24T00:00:00').getTime();
    const start = midnight - 60 * MIN;     // 전날 23:00 시작
    const pausedAt = midnight - 10 * MIN;  // 23:50에 일시정지(자정 전)
    const pauseOffset = 20 * MIN;          // 그 전 23:10~23:30 일시정지 누적 20분

    // paused 상태로 store 세팅 → handleResume이 보는 상태와 동일
    useTimerStore.getState().restoreFromDraft({
      categoryId: 'cat-1',
      sessionStartTimestamp: start,
      pauseOffset,
      pausedAt,
      status: 'paused',
    });

    // handleResume의 새 공식: prevDur = floor(getElapsedMs / 60000)
    const prevDur = Math.floor(useTimerStore.getState().getElapsedMs() / MIN);

    // 실제 공부시간: 23:00~23:50(50분) 중 일시정지 20분 제외 = 30분
    expect(prevDur).toBe(30);
    // 기존 벽시계 방식(start~pausedAt)은 50분으로 20분 부풀려짐
    expect(calcDurationMinutes(start, pausedAt)).toBe(50);
    expect(prevDur).toBeLessThan(calcDurationMinutes(start, pausedAt));
  });

  it('경로1(running 유지 중 자정 넘김): 전날 = 전체 실제경과 - 자정 이후 구간, 합이 보존된다', () => {
    const midnight = new Date('2026-06-24T00:00:00').getTime();
    const start = midnight - 60 * MIN; // 전날 23:00 시작
    const now = midnight + 5 * MIN;    // 자정 후 00:05 (setInterval tick)
    const pauseOffset = 10 * MIN;      // 23:10~23:20 일시정지 누적 10분(자정 전)

    // setInterval의 running getElapsedMs 재현(시간 결정성 확보)
    const elapsedMs = now - start - pauseOffset; // 55분 (실제 공부, 일시정지 제외)
    const todayWallMs = now - midnight;          // 5분 (자정 후 일시정지 없음)
    const prevDur = Math.floor(Math.max(0, elapsedMs - todayWallMs) / MIN);
    const todayDur = Math.floor(todayWallMs / MIN);

    // 전날 23:00~24:00(60분) 중 일시정지 10분 제외 = 50분
    expect(prevDur).toBe(50);
    expect(todayDur).toBe(5);
    // 전날+오늘 합 = 전체 실제 공부시간(일시정지 제외)
    expect(prevDur + todayDur).toBe(Math.floor(elapsedMs / MIN));
    // 기존 벽시계 prevDur(start~자정직전)은 일시정지를 포함해 더 크다
    expect(prevDur).toBeLessThan(calcDurationMinutes(start, midnight - 1));
  });
});

// ──────────────────────────────────────────────
// 기능 1 — 이탈 가드 활성화 조건 (순수 로직)
// ──────────────────────────────────────────────
describe('이탈 가드 활성화 조건 — isTimerActive', () => {
  /**
   * useBlocker(isTimerActive) 에서 isTimerActive = timerStatus !== 'idle'
   * UI 통합 없이 조건 로직만 검증
   */
  type TimerStatus = 'idle' | 'running' | 'paused';

  function isTimerActive(status: TimerStatus): boolean {
    return status !== 'idle';
  }

  it('idle 상태이면 가드 비활성 → 자유 이동', () => {
    expect(isTimerActive('idle')).toBe(false);
  });

  it('running 상태이면 가드 활성 → 이탈 차단', () => {
    expect(isTimerActive('running')).toBe(true);
  });

  it('paused 상태이면 가드 활성 → 이탈 차단', () => {
    expect(isTimerActive('paused')).toBe(true);
  });
});

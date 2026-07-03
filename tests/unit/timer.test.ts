import { describe, it, expect } from 'vitest';
import { calcDurationMinutes, formatElapsedTime, isSameLocalDate, getLocalMidnight, getLocalDateString } from '@/lib/calculator/timer';

describe('calcDurationMinutes', () => {
  it('60000ms → 1분', () => {
    const start = 1000000;
    expect(calcDurationMinutes(start, start + 60000)).toBe(1);
  });

  it('59999ms → 0분 (Math.floor)', () => {
    const start = 1000000;
    expect(calcDurationMinutes(start, start + 59999)).toBe(0);
  });

  it('3600000ms → 60분', () => {
    const start = 1000000;
    expect(calcDurationMinutes(start, start + 3600000)).toBe(60);
  });

  it('0ms → 0분', () => {
    const ts = Date.now();
    expect(calcDurationMinutes(ts, ts)).toBe(0);
  });
});

describe('formatElapsedTime', () => {
  it('0ms → 00:00:00', () => {
    expect(formatElapsedTime(0)).toBe('00:00:00');
  });

  it('3661000ms → 01:01:01', () => {
    expect(formatElapsedTime(3661000)).toBe('01:01:01');
  });

  it('60000ms → 00:01:00', () => {
    expect(formatElapsedTime(60000)).toBe('00:01:00');
  });
});

// ==============================
// CRIT-01 자정 분리 유틸
// ==============================
describe('isSameLocalDate', () => {
  it('같은 날 두 시각 → true', () => {
    // 2026-06-23 08:00 ~ 2026-06-23 23:59
    const a = new Date('2026-06-23T08:00:00').getTime();
    const b = new Date('2026-06-23T23:59:00').getTime();
    expect(isSameLocalDate(a, b)).toBe(true);
  });

  it('자정 직전/직후 → false', () => {
    const before = new Date('2026-06-23T23:59:59').getTime();
    const after  = new Date('2026-06-24T00:00:01').getTime();
    expect(isSameLocalDate(before, after)).toBe(false);
  });

  it('같은 timestamp → true', () => {
    const ts = new Date('2026-06-23T12:00:00').getTime();
    expect(isSameLocalDate(ts, ts)).toBe(true);
  });

  it('날짜만 다르고 시각 같음 → false', () => {
    const a = new Date('2026-06-23T12:00:00').getTime();
    const b = new Date('2026-06-24T12:00:00').getTime();
    expect(isSameLocalDate(a, b)).toBe(false);
  });
});

describe('getLocalMidnight', () => {
  it('특정 날짜의 자정(ms) 반환', () => {
    const ts = new Date('2026-06-23T15:30:00').getTime();
    const midnight = getLocalMidnight(ts);
    const d = new Date(midnight);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it('자정 그 자체를 넣어도 같은 날 자정 반환', () => {
    const d = new Date('2026-06-23T00:00:00');
    const midnight = getLocalMidnight(d.getTime());
    expect(new Date(midnight).getDate()).toBe(d.getDate());
    expect(new Date(midnight).getHours()).toBe(0);
  });

  it('자정 분리: 전날 구간 + 오늘 구간 = 전체 구간 (분 단위)', () => {
    // 23:58 ~ 00:10 세션 (자정 걸침)
    const sessionStart = new Date('2026-06-23T23:58:00').getTime();
    const sessionEnd   = new Date('2026-06-24T00:10:00').getTime();
    const midnight     = getLocalMidnight(sessionEnd); // 2026-06-24 00:00

    const prevDur = calcDurationMinutes(sessionStart, midnight - 1); // 23일 구간
    const todayDur = calcDurationMinutes(midnight, sessionEnd);       // 24일 구간

    // 23:58 → 자정 = 약 2분, 자정 → 00:10 = 10분
    expect(prevDur).toBe(1);   // floor((midnight-1 - 23:58) / 60000) = floor(119999/60000) = 1
    expect(todayDur).toBe(10); // floor(600000/60000) = 10
  });
});

// ==============================
// CRIT-NEW-01 로컬 날짜 문자열 (UTC 날짜 밀림 방지)
// ==============================
describe('getLocalDateString', () => {
  it('로컬 시각이 속한 날짜를 YYYY-MM-DD로 반환', () => {
    // 로컬 기준 2026-06-23의 어떤 시각이든 같은 날짜 문자열
    const ts = new Date('2026-06-23T15:30:00').getTime();
    expect(getLocalDateString(ts)).toBe('2026-06-23');
  });

  it('자정 직후 새벽 시각도 그날 날짜 (UTC로 밀리지 않음)', () => {
    // UTC+9 환경에서 오전 8시는 UTC로는 전날 23시 → toISOString이면 하루 밀림
    const ts = new Date('2026-06-23T08:00:00').getTime();
    expect(getLocalDateString(ts)).toBe('2026-06-23');
  });

  it('월/일 한 자리 수 zero-padding', () => {
    const ts = new Date('2026-01-05T10:00:00').getTime();
    expect(getLocalDateString(ts)).toBe('2026-01-05');
  });

  it('인자 없이 호출하면 오늘 로컬 날짜', () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(getLocalDateString()).toBe(expected);
  });
});

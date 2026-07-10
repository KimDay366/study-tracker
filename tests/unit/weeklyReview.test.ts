/**
 * M4 + M6 + M7 관련 추가 테스트
 * - 하트 이분법 계산 (D-3: 10% 단위, 반개 없음)
 * - 루틴 우선순위 (D-5)
 * - 스토리지 용량 계산 (D-7)
 * - 명언 30개 확인 (D-6)
 * - MAJ-04 한줄다짐 저장 조건 (pledge 단독 판단)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calcFilledHearts, calcHalfHeart } from '@/lib/calculator/achievement';
import { resolveRoutineLogic } from '@/hooks/useRoutine';
import { QUOTES, getRandomQuote } from '@/lib/quotes';
import { isSameLocalDate, getLocalMidnight, calcDurationMinutes } from '@/lib/calculator/timer';
import type { StudyLogic, RoutineSetting } from '@/types';

// ==============================
// D-3 이분법 하트 계산 (WeeklyReview HeartRow와 동일 플랜)
// fullHearts = Math.floor(pct / 10)
// emptyHearts = 10 - fullHearts
// ==============================
function calcHeartSlots(pct: number) {
  const full = Math.floor(pct / 10);
  const empty = 10 - full;
  return { full, half: 0, empty };
}

describe('WeeklyReview HeartRow — D-3 이분법 하트 (10% 단위, 반개 없음)', () => {
  it('0% → 전부 빈 하트 10개', () => {
    const { full, half, empty } = calcHeartSlots(0);
    expect(full).toBe(0);
    expect(half).toBe(0);
    expect(empty).toBe(10);
  });

  it('5% → 채워진 0개, 빈 10개 (이분법: 반개 하트 없음)', () => {
    const { full, half, empty } = calcHeartSlots(5);
    expect(full).toBe(0);
    expect(half).toBe(0);
    expect(empty).toBe(10);
  });

  it('10% → 채워진 1개, 빈 9개', () => {
    const { full, half, empty } = calcHeartSlots(10);
    expect(full).toBe(1);
    expect(half).toBe(0);
    expect(empty).toBe(9);
  });

  it('73% → 채워진 7개, 빈 3개 (이분법: 반개 없음)', () => {
    const { full, half, empty } = calcHeartSlots(73);
    expect(full).toBe(7);
    expect(half).toBe(0);
    expect(empty).toBe(3);
  });

  it('83% → 채워진 8개, 빈 2개 (이분법: 반개 없음)', () => {
    const { full, half, empty } = calcHeartSlots(83);
    expect(full).toBe(8);
    expect(half).toBe(0);
    expect(empty).toBe(2);
  });

  it('100% → 채워진 10개 (무지개 처리는 컴포넌트 레벨)', () => {
    const { full, half, empty } = calcHeartSlots(100);
    expect(full).toBe(10);
    expect(half).toBe(0);
    expect(empty).toBe(0);
  });

  it('50% → 채워진 5개, 반개 없음', () => {
    const { full, half } = calcHeartSlots(50);
    expect(full).toBe(5);
    expect(half).toBe(0);
  });

  it('D-3 정책: calcHalfHeart는 항상 false (이분법)', () => {
    // D-3 이분법 정책: 반개 하트 제거
    expect(calcHalfHeart(5)).toBe(false);
    expect(calcHalfHeart(15)).toBe(false);
    expect(calcHalfHeart(10)).toBe(false);
    expect(calcHalfHeart(0)).toBe(false);
  });
});

// ==============================
// D-5 루틴 우선순위 — resolveRoutineLogic
// ==============================
function makeLogic(id: string, name: string): StudyLogic {
  return {
    id, name,
    totalTargetMinutes: 60,
    categories: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeDayRoutine(
  enabled: boolean,
  logicId: string | null = null,
  time: string | null = '08:30',
): RoutineSetting['days'][string] {
  return { enabled, logicId, time };
}

describe('D-5 루틴 우선순위 — resolveRoutineLogic', () => {
  const LOGIC_A = makeLogic('logic-a', '수능 D-100');
  const LOGIC_B = makeLogic('logic-b', '내신 대비');
  const ALL_LOGICS = [LOGIC_A, LOGIC_B];

  // today dow를 고정하기 위해 Date mock
  beforeEach(() => {
    // 2026-06-15 월요일 (dow=1, 09:00)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T09:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('1순위: 오늘 요일 루틴 활성+플랜 지정 → 해당 플랜, banner=routine-match', () => {
    const routine: RoutineSetting = {
      days: { '1': makeDayRoutine(true, 'logic-a', '08:30') },
      updatedAt: '2026-06-15T00:00:00.000Z',
    };
    const result = resolveRoutineLogic({
      routine, logics: ALL_LOGICS,
      lastUsedLogicId: 'logic-b',
      hasExistingRecord: false,
    });
    expect(result.resolvedLogicId).toBe('logic-a');
    // 09:00 > 08:30 이므로 time-passed
    expect(result.banner.type).toBe('routine-time-passed');
    expect(result.banner.logicName).toBe('수능 D-100');
  });

  it('1순위: 루틴 시간 이전 접속 → routine-match', () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00')); // 08:00 < 08:30
    const routine: RoutineSetting = {
      days: { '1': makeDayRoutine(true, 'logic-a', '08:30') },
      updatedAt: '2026-06-15T00:00:00.000Z',
    };
    const result = resolveRoutineLogic({
      routine, logics: ALL_LOGICS,
      lastUsedLogicId: null,
      hasExistingRecord: false,
    });
    expect(result.resolvedLogicId).toBe('logic-a');
    expect(result.banner.type).toBe('routine-match');
  });

  it('2순위: 루틴 활성+플랜 null → lastUsedLogicId, banner=routine-no-logic', () => {
    const routine: RoutineSetting = {
      days: { '1': makeDayRoutine(true, null, '08:30') },
      updatedAt: '2026-06-15T00:00:00.000Z',
    };
    const result = resolveRoutineLogic({
      routine, logics: ALL_LOGICS,
      lastUsedLogicId: 'logic-b',
      hasExistingRecord: false,
    });
    expect(result.resolvedLogicId).toBe('logic-b');
    expect(result.banner.type).toBe('routine-no-logic');
  });

  it('3순위: 오늘 루틴 비활성 → lastUsedLogicId, 배너 없음', () => {
    const routine: RoutineSetting = {
      days: { '1': makeDayRoutine(false, 'logic-a', '08:30') },
      updatedAt: '2026-06-15T00:00:00.000Z',
    };
    const result = resolveRoutineLogic({
      routine, logics: ALL_LOGICS,
      lastUsedLogicId: 'logic-b',
      hasExistingRecord: false,
    });
    expect(result.resolvedLogicId).toBe('logic-b');
    expect(result.banner.type).toBe('none');
  });

  it('4순위: RoutineSetting null + lastUsedLogicId null → null, 배너 없음', () => {
    const result = resolveRoutineLogic({
      routine: null, logics: ALL_LOGICS,
      lastUsedLogicId: null,
      hasExistingRecord: false,
    });
    expect(result.resolvedLogicId).toBeNull();
    expect(result.banner.type).toBe('none');
  });

  it('경계: 오늘 DailyRecord 이미 있으면 루틴 판단 스킵', () => {
    const routine: RoutineSetting = {
      days: { '1': makeDayRoutine(true, 'logic-a', '08:30') },
      updatedAt: '2026-06-15T00:00:00.000Z',
    };
    const result = resolveRoutineLogic({
      routine, logics: ALL_LOGICS,
      lastUsedLogicId: 'logic-b',
      hasExistingRecord: true, // 이미 공부 시작함
    });
    expect(result.resolvedLogicId).toBe('logic-b'); // 기존 플랜 유지
    expect(result.banner.type).toBe('none');
  });

  it('경계: 루틴 지정 플랜 삭제됨 → routine-deleted', () => {
    const routine: RoutineSetting = {
      days: { '1': makeDayRoutine(true, 'deleted-logic', '08:30') },
      updatedAt: '2026-06-15T00:00:00.000Z',
    };
    const result = resolveRoutineLogic({
      routine, logics: ALL_LOGICS, // 'deleted-logic'은 없음
      lastUsedLogicId: 'logic-b',
      hasExistingRecord: false,
    });
    expect(result.banner.type).toBe('routine-deleted');
    expect(result.resolvedLogicId).toBe('logic-b'); // lastUsedLogicId 폴백
  });
});

// ==============================
// D-6 명언 개수 검증
// ==============================
describe('D-6 내장 명언', () => {
  it('최소 30개 탑재', () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(30);
  });

  it('각 명언은 text와 source를 갖는다', () => {
    QUOTES.forEach((q, i) => {
      expect(typeof q.text, `[${i}] text 타입`).toBe('string');
      expect(q.text.length, `[${i}] text 비어있지 않음`).toBeGreaterThan(0);
      expect(typeof q.source, `[${i}] source 타입`).toBe('string');
    });
  });
});

// ==============================
// D-7 스토리지 용량 계산 — 단위 테스트
// ==============================
function calcStorageUsageTest(lsData: Record<string, string>): {
  usedBytes: number;
  usedPercent: number;
} {
  const LS_TOTAL_BYTES = 5 * 1024 * 1024;
  const usedBytes = Object.keys(lsData)
    .filter(k => k.startsWith('st_'))
    .reduce((acc, k) => acc + (lsData[k]?.length ?? 0) * 2, 0);
  const usedPercent = Math.round((usedBytes / LS_TOTAL_BYTES) * 100);
  return { usedBytes, usedPercent };
}

describe('D-7 스토리지 용량 계산', () => {
  it('빈 데이터 → 0 bytes', () => {
    const { usedBytes, usedPercent } = calcStorageUsageTest({});
    expect(usedBytes).toBe(0);
    expect(usedPercent).toBe(0);
  });

  it('st_ 키만 집계', () => {
    const { usedBytes } = calcStorageUsageTest({
      'st_logics': 'a'.repeat(100),   // 100글자 * 2 = 200bytes
      'other_key': 'b'.repeat(1000),  // 집계 안됨
    });
    expect(usedBytes).toBe(200);
  });

  it('80% 경고 임계값 확인', () => {
    const LS_TOTAL = 5 * 1024 * 1024; // 5MB
    const threshold80 = Math.floor(LS_TOTAL * 0.8); // 4194304 bytes
    // 4MB 이상이면 80% 초과
    const { usedPercent } = calcStorageUsageTest({
      'st_large': 'x'.repeat(threshold80 / 2 + 1), // 2bytes/char이므로
    });
    expect(usedPercent).toBeGreaterThanOrEqual(80);
  });

  it('50% 미만 정상 상태', () => {
    const { usedPercent } = calcStorageUsageTest({
      'st_small': 'x'.repeat(100),
    });
    expect(usedPercent).toBeLessThan(80);
  });
});

// ==============================
// MAJ-04 한줄다짐 저장 조건
// pledge 단독 판단: 비어있으면 랜덤 명언 고정, 입력 시 그대로
// ==============================

/** handleSave 내 pledge 결정 플랜 추출 (순수 함수로 테스트) */
function resolvePledge(pledge: string): {
  pledgeText: string;
  usedBuiltinQuote: boolean;
  builtinQuoteIndex: number | null;
} {
  if (pledge.trim() === '') {
    const { quote, index } = getRandomQuote();
    return { pledgeText: quote.text, usedBuiltinQuote: true, builtinQuoteIndex: index };
  }
  return { pledgeText: pledge.trim(), usedBuiltinQuote: false, builtinQuoteIndex: null };
}

describe('MAJ-04 한줄다짐 저장 조건 — pledge 단독 판단', () => {
  it('pledge 비어있으면 → 랜덤 명언 고정, usedBuiltinQuote=true', () => {
    const result = resolvePledge('');
    expect(result.usedBuiltinQuote).toBe(true);
    expect(result.builtinQuoteIndex).not.toBeNull();
    expect(QUOTES[result.builtinQuoteIndex!].text).toBe(result.pledgeText);
  });

  it('pledge 공백만 → 랜덤 명언 고정 (trim 처리)', () => {
    const result = resolvePledge('   ');
    expect(result.usedBuiltinQuote).toBe(true);
    expect(result.builtinQuoteIndex).not.toBeNull();
  });

  it('pledge 직접 입력 → 그대로 저장, usedBuiltinQuote=false', () => {
    const result = resolvePledge('매일 한 시간 집중하기');
    expect(result.pledgeText).toBe('매일 한 시간 집중하기');
    expect(result.usedBuiltinQuote).toBe(false);
    expect(result.builtinQuoteIndex).toBeNull();
  });

  it('pledge 앞뒤 공백 trim 후 저장', () => {
    const result = resolvePledge('  열심히 하자  ');
    expect(result.pledgeText).toBe('열심히 하자');
    expect(result.usedBuiltinQuote).toBe(false);
  });

  it('pledge=비어있음 → KPT 입력 여부 무관하게 명언 선택', () => {
    // keep/problem/tryText 값이 있어도 pledge 비면 명언 선택
    const result = resolvePledge('');
    expect(result.usedBuiltinQuote).toBe(true);
  });

  it('"이 문장으로 저장" 클릭 후 pledge 채워지면 → 직접 입력으로 처리', () => {
    // 명언 카드에서 채움 버튼을 누르면 setPledge(quote.text) → 저장 시 직접 입력으로 간주
    const quoteText = QUOTES[0].text;
    const result = resolvePledge(quoteText);
    // 사용자가 직접 입력 필드에 채운 것이므로 usedBuiltinQuote=false
    expect(result.usedBuiltinQuote).toBe(false);
    expect(result.pledgeText).toBe(quoteText);
  });

  it('pledge 200자 최대 (입력 필드 제한은 UI 레벨, 플랜 레벨 trim만)', () => {
    const longPledge = 'a'.repeat(200);
    const result = resolvePledge(longPledge);
    expect(result.pledgeText).toBe(longPledge);
    expect(result.usedBuiltinQuote).toBe(false);
  });
});

// ==============================
// CRIT-01 보강 — 일시정지 중 자정 경과 감지
// isSameLocalDate(pausedAt기준start, resumeTime)으로 판단
// ==============================
describe('CRIT-01 보강 — 일시정지 중 자정 경과', () => {
  it('일시정지 중 자정 경과 → isSameLocalDate(start, now) = false 감지', () => {
    const start = new Date('2026-06-23T22:00:00').getTime();
    const resumeAt = new Date('2026-06-24T08:00:00').getTime();
    expect(isSameLocalDate(start, resumeAt)).toBe(false);
  });

  it('같은 날 재개 → isSameLocalDate = true (일반 재개)', () => {
    const start = new Date('2026-06-23T10:00:00').getTime();
    const resumeAt = new Date('2026-06-23T11:00:00').getTime();
    expect(isSameLocalDate(start, resumeAt)).toBe(true);
  });

  it('자정 직전 일시정지 → 자정 직후 재개: 전날 세션 구간(분) 계산', () => {
    const start = new Date('2026-06-23T23:50:00').getTime();
    const pausedAt = new Date('2026-06-23T23:55:00').getTime(); // 5분 후 일시정지
    const resumeAt = new Date('2026-06-24T08:00:00').getTime();

    // 재개 시 전날 세션: start ~ pausedAt
    const prevDur = calcDurationMinutes(start, pausedAt);
    expect(prevDur).toBe(5);

    // 자정 경과 감지 (start 기준)
    expect(isSameLocalDate(start, resumeAt)).toBe(false);

    // 재개 시점부터 새 세션 시작 (미래 실행분은 별도 세션)
    const midnight = getLocalMidnight(resumeAt); // 2026-06-24 00:00
    expect(midnight).toBe(new Date('2026-06-24T00:00:00').getTime());
  });

  it('여러 날 경과 후 재개: start가 이틀 전이어도 감지', () => {
    const start = new Date('2026-06-21T20:00:00').getTime();
    const resumeAt = new Date('2026-06-23T09:00:00').getTime();
    expect(isSameLocalDate(start, resumeAt)).toBe(false);
  });
});

// ==============================
// MAJ-NEW-01 회귀 — 기존 주간 정리 재접근 시 pledge 복원 정책
// setPledge(existing.pledge) — usedBuiltinQuote 무관하게 항상 복원
// ==============================

/** useEffect 내 pledge 초기화 플랜 추출 (순수 함수로 테스트) */
function restorePledge(existing: {
  pledge: string;
  usedBuiltinQuote: boolean;
} | null): string {
  if (!existing) return '';
  // MAJ-NEW-01 수정 후: usedBuiltinQuote 여부 무관하게 저장된 pledge 복원
  return existing.pledge;
}

describe('MAJ-NEW-01 회귀 — 기존 주간 정리 재접근 시 pledge 복원 정책', () => {
  it('직접 입력 저장 → 재접근 시 pledge 그대로 복원', () => {
    const existing = { pledge: '매일 한 시간 집중하기', usedBuiltinQuote: false };
    expect(restorePledge(existing)).toBe('매일 한 시간 집중하기');
  });

  it('명언(usedBuiltinQuote=true)으로 저장 → 재접근 시 명언 텍스트 그대로 복원 (MAJ-NEW-01 핵심)', () => {
    const quoteText = QUOTES[0].text;
    const existing = { pledge: quoteText, usedBuiltinQuote: true };
    expect(restorePledge(existing)).toBe(quoteText);
  });

  it('명언 저장 후 재접근 → pledge 채워진 상태 → handleSave 시 동일 텍스트 유지 (재저장 불변)', () => {
    const quoteText = QUOTES[2].text;
    // 재접근 시 복원된 pledge로 handleSave 호출 시뮬레이션
    const restored = restorePledge({ pledge: quoteText, usedBuiltinQuote: true });
    // pledge가 채워져 있으므로 else 분기 → 그대로 저장, 새 명언 선택 없음
    const result = resolvePledge(restored);
    expect(result.pledgeText).toBe(quoteText);
    expect(result.usedBuiltinQuote).toBe(false); // 재저장 시 직접 입력으로 처리
  });

  it('빈 다짐 저장(명언 자동) → 재접근 → 그대로 저장 시 명언 변경 없음', () => {
    // 1. 첫 저장: pledge='' → 명언 A 고정
    const firstSave = resolvePledge('');
    expect(firstSave.usedBuiltinQuote).toBe(true);
    const savedPledge = firstSave.pledgeText;

    // 2. 재접근: 저장된 pledgeText를 필드에 복원
    const restored = restorePledge({ pledge: savedPledge, usedBuiltinQuote: true });
    expect(restored).toBe(savedPledge); // 명언 텍스트 그대로 복원됨

    // 3. 수정 없이 저장: pledge=savedPledge(비어있지 않음) → 동일 텍스트 유지
    const reSave = resolvePledge(restored);
    expect(reSave.pledgeText).toBe(savedPledge); // 새 랜덤 명언으로 덮어쓰기 없음
  });

  it('기존 주간 정리 없음(새 주) → pledge 빈 문자열 반환', () => {
    expect(restorePledge(null)).toBe('');
  });
});

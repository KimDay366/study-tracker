import type { StudyLogic, RoutineSetting } from '@/types';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

export interface RoutineBannerInfo {
  type: 'routine-match' | 'routine-no-logic' | 'routine-time-passed' | 'routine-deleted' | 'none';
  logicName?: string;
  time?: string;
}

export interface UseRoutineResult {
  /** D-5 우선순위 로직으로 결정된 selectedLogicId (null이면 온보딩 유도) */
  resolvedLogicId: string | null;
  banner: RoutineBannerInfo;
  todayRoutine: RoutineSetting['days'][string] | null;
}

function getTodayDow(): number {
  return new Date().getDay(); // 0=일 ~ 6=토
}

export function getCurrentTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isTimePassed(routineTime: string): boolean {
  return getCurrentTime() > routineTime; // "HH:MM" 문자열 비교 — 동일 포맷이므로 가능
}

/**
 * D-5 루틴 우선순위 정책 구현
 * 1순위: 오늘 요일 루틴 활성 + logicId 지정 → 해당 로직
 * 2순위: 오늘 요일 루틴 활성 + logicId null → lastUsedLogicId
 * 3순위: 오늘 요일 루틴 비활성 → lastUsedLogicId
 * 4순위: lastUsedLogicId null → null (온보딩 유도)
 */
export function resolveRoutineLogic(params: {
  routine: RoutineSetting | null;
  logics: StudyLogic[];
  lastUsedLogicId: string | null;
  hasExistingRecord: boolean;
}): UseRoutineResult {
  const { routine, logics, lastUsedLogicId, hasExistingRecord } = params;
  const dow = getTodayDow();
  const dowKey = String(dow);

  const todayRoutine = routine?.days[dowKey] ?? null;
  const noBanner: RoutineBannerInfo = { type: 'none' };

  // 오늘 이미 공부 기록 있으면 배너 미표시, 기존 로직 유지
  if (hasExistingRecord) {
    return { resolvedLogicId: lastUsedLogicId, banner: noBanner, todayRoutine };
  }

  // 1순위: 오늘 요일 루틴 활성 + logicId 지정
  if (todayRoutine?.enabled && todayRoutine.logicId) {
    const logic = logics.find(l => l.id === todayRoutine.logicId);
    if (logic) {
      if (todayRoutine.time && isTimePassed(todayRoutine.time)) {
        return {
          resolvedLogicId: logic.id,
          banner: { type: 'routine-time-passed', logicName: logic.name, time: todayRoutine.time },
          todayRoutine,
        };
      }
      return {
        resolvedLogicId: logic.id,
        banner: { type: 'routine-match', logicName: logic.name, time: todayRoutine.time ?? undefined },
        todayRoutine,
      };
    }
    // 루틴 지정 로직이 삭제된 경우 → 3순위로 폴백
    const fallback = logics.find(l => l.id === lastUsedLogicId) ? lastUsedLogicId : null;
    return {
      resolvedLogicId: fallback,
      banner: { type: 'routine-deleted' },
      todayRoutine,
    };
  }

  // 2순위: 오늘 요일 루틴 활성 + logicId null
  if (todayRoutine?.enabled && !todayRoutine.logicId) {
    return {
      resolvedLogicId: lastUsedLogicId,
      banner: { type: 'routine-no-logic' },
      todayRoutine,
    };
  }

  // 3순위: 오늘 요일 루틴 비활성 or 루틴 없음 → lastUsedLogicId, 배너 없음
  return {
    resolvedLogicId: lastUsedLogicId,
    banner: noBanner,
    todayRoutine,
  };
}

/** 배너 메시지 텍스트 생성 */
export function getRoutineBannerText(banner: RoutineBannerInfo): string {
  switch (banner.type) {
    case 'routine-match':
      return banner.time
        ? `[${banner.logicName}] 루틴 시간이에요(${banner.time}). 오늘도 화이팅!`
        : `[${banner.logicName}] 루틴이에요. 오늘도 화이팅!`;
    case 'routine-time-passed':
      return `[${banner.logicName}] 루틴 시간(${banner.time})이 지났어요. 지금 시작해 볼까요?`;
    case 'routine-no-logic':
      return '오늘 루틴 시간이에요. 로직을 선택해 주세요.';
    case 'routine-deleted':
      return '루틴에 설정된 로직이 삭제됐어요. 루틴을 다시 설정해 주세요.';
    default:
      return '';
  }
}

export { DAY_NAMES };

import type { StudyLogic, LogicSnapshot } from '@/types';

/** StudyLogic → 세션 추가 시 함께 보낼 LogicSnapshot 생성 (플랜/활동이 나중에 바뀌어도 그 시점 값을 박제). */
export function buildLogicSnapshot(logic: StudyLogic): LogicSnapshot {
  return {
    name: logic.name,
    totalTargetMinutes: logic.totalTargetMinutes,
    categories: logic.categories.map(c => ({
      id: c.id,
      name: c.name,
      colorVar: c.colorVar,
      targetMinutes: c.targetMinutes,
      targetPercent: c.targetPercent,
    })),
  };
}

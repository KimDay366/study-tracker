/**
 * 다중 플랜 대응 회귀 테스트 (F6) — useCalendarMonth
 *
 * §8-2 정책: 캘린더 달 뷰 하루 셀의 무지개 하트/별은 "하루 전체 합산"이 아니라
 * "플랜 그룹별로 각각" 판정하고, 플랜 수만큼 누적되어야 한다.
 * 이 테스트는 recordMap이 같은 날짜에 플랜 그룹을 여러 개 담을 수 있게 된 뒤에도
 * 그룹 간 달성률이 서로 섞이지 않고 독립적으로 계산되는지 검증한다.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCalendarMonth } from '@/hooks/useCalendarMonth';
import type { DailyRecord, Session } from '@/types';

function makeSession(id: string, categoryId: string, durationMinutes: number): Session {
  return {
    id,
    categoryId,
    sessionStartTimestamp: 0,
    sessionEndTimestamp: 0,
    durationMinutes,
    isManuallyEdited: false,
    editedAt: null,
    source: 'timer',
  };
}

function makeRecord(params: {
  logicId: string;
  logicName: string;
  totalTargetMinutes: number;
  sessions: Session[];
}): DailyRecord {
  const cat = { id: 'cat-1', name: '활동', colorVar: '--cat-color-01', targetMinutes: params.totalTargetMinutes, targetPercent: 100 };
  return {
    date: '2026-07-07',
    logicId: params.logicId,
    logicSnapshot: { name: params.logicName, totalTargetMinutes: params.totalTargetMinutes, categories: [cat] },
    sessions: params.sessions,
    achievementCache: null,
    createdAt: '2026-07-07T00:00:00.000Z',
    updatedAt: '2026-07-07T00:00:00.000Z',
  };
}

describe('useCalendarMonth — 다중 플랜 그룹별 집계 (§8-1, §8-2)', () => {
  it('같은 날짜에 플랜 그룹이 2개면 groups 배열에 둘 다 담기고, 서로 독립적으로 달성률이 계산된다', () => {
    // 플랜A: 30분 목표에 30분 채움 → 100%
    const groupA = makeRecord({
      logicId: 'logic-a', logicName: '플랜A', totalTargetMinutes: 30,
      sessions: [makeSession('s1', 'cat-1', 30)],
    });
    // 플랜B: 60분 목표에 10분만 채움 → 16.7%
    const groupB = makeRecord({
      logicId: 'logic-b', logicName: '플랜B', totalTargetMinutes: 60,
      sessions: [makeSession('s2', 'cat-1', 10)],
    });

    const recordMap = new Map([['2026-07-07', [groupA, groupB]]]);
    const { result } = renderHook(() => useCalendarMonth(2026, 7, recordMap));

    const info = result.current.dayInfoMap.get('2026-07-07');
    expect(info).toBeDefined();
    expect(info!.groups).toHaveLength(2);

    const gA = info!.groups.find(g => g.record.logicId === 'logic-a')!;
    const gB = info!.groups.find(g => g.record.logicId === 'logic-b')!;

    // 그룹 A는 100% 달성 → 하트·별 모두 획득 (활동 1개, 100% 이상)
    expect(gA.totalAchievementPercent).toBe(100);
    expect(gA.rainbowHeart).toBe(true);
    expect(gA.rainbowStar).toBe(true);

    // 그룹 B는 16.7%로 낮음 → 뱃지 없음. A의 100% 달성이 B로 섞여 들어오지 않는다(합산 없음 검증).
    expect(gB.totalAchievementPercent).toBeCloseTo(16.7, 1);
    expect(gB.rainbowHeart).toBe(false);
    expect(gB.rainbowStar).toBe(false);

    // day-level totalMinutes는 셀 표시용 단순 합계(30+10=40)일 뿐, 달성률 판정에는 쓰이지 않는다.
    expect(info!.totalMinutes).toBe(40);
  });

  it('플랜 그룹이 모두 100% 달성이면, group.rainbowHeart/rainbowStar(그룹 단위 필드)가 그룹 수만큼 true다', () => {
    // 주의: 여기서 세는 rainbowHeart/rainbowStar는 CalendarGroupInfo(그룹 단위) 필드다.
    // 달력 셀의 무지개 하트 배지는 이 rainbowHeart 개수를 그대로 누적해서 쓰지만,
    // 무지개 별 배지는 더 이상 그룹별 rainbowStar를 쓰지 않고 day-level allLogicsAchieved로 대체됐다(아래 테스트 참고).
    const fullGroup = (logicId: string) => makeRecord({
      logicId, logicName: logicId, totalTargetMinutes: 10,
      sessions: [makeSession(`s-${logicId}`, 'cat-1', 10)],
    });
    const recordMap = new Map([['2026-07-07', [fullGroup('logic-a'), fullGroup('logic-b'), fullGroup('logic-c')]]]);
    const { result } = renderHook(() => useCalendarMonth(2026, 7, recordMap));

    const info = result.current.dayInfoMap.get('2026-07-07')!;
    const heartCount = info.groups.filter(g => g.rainbowHeart).length;
    const starCount = info.groups.filter(g => g.rainbowStar).length;

    expect(heartCount).toBe(3);
    expect(starCount).toBe(3);
  });

  it('무지개 별(day-level): 그날 플랜이 여러 개이고 전부 달성이면 allLogicsAchieved는 true — 그룹 수와 무관하게 딱 1개짜리 판정', () => {
    const fullGroup = (logicId: string) => makeRecord({
      logicId, logicName: logicId, totalTargetMinutes: 10,
      sessions: [makeSession(`s-${logicId}`, 'cat-1', 10)],
    });
    const recordMap = new Map([['2026-07-07', [fullGroup('logic-a'), fullGroup('logic-b'), fullGroup('logic-c')]]]);
    const { result } = renderHook(() => useCalendarMonth(2026, 7, recordMap));

    const info = result.current.dayInfoMap.get('2026-07-07')!;
    expect(info.allLogicsAchieved).toBe(true);
  });

  it('무지개 별(day-level): 플랜 중 하나라도 미달성이면 allLogicsAchieved는 false다', () => {
    const groupA = makeRecord({
      logicId: 'logic-a', logicName: 'A', totalTargetMinutes: 10,
      sessions: [makeSession('s-a', 'cat-1', 10)], // 100% 달성
    });
    const groupB = makeRecord({
      logicId: 'logic-b', logicName: 'B', totalTargetMinutes: 60,
      sessions: [makeSession('s-b', 'cat-1', 10)], // 16.7%만 달성
    });
    const recordMap = new Map([['2026-07-07', [groupA, groupB]]]);
    const { result } = renderHook(() => useCalendarMonth(2026, 7, recordMap));

    const info = result.current.dayInfoMap.get('2026-07-07')!;
    expect(info.allLogicsAchieved).toBe(false);
  });

  it('플랜 그룹이 없는 날짜는 dayInfoMap에 없다(기록 없음)', () => {
    const recordMap = new Map<string, DailyRecord[]>();
    const { result } = renderHook(() => useCalendarMonth(2026, 7, recordMap));
    expect(result.current.dayInfoMap.get('2026-07-07')).toBeUndefined();
  });

  it('월간 목표 합계(monthStats.totalTarget)는 그 달의 모든 플랜 그룹의 목표시간을 합산한다', () => {
    const groupA = makeRecord({ logicId: 'logic-a', logicName: 'A', totalTargetMinutes: 30, sessions: [] });
    const groupB = makeRecord({ logicId: 'logic-b', logicName: 'B', totalTargetMinutes: 60, sessions: [] });
    const recordMap = new Map([['2026-07-07', [groupA, groupB]]]);
    const { result } = renderHook(() => useCalendarMonth(2026, 7, recordMap));
    expect(result.current.monthStats.totalTarget).toBe(90);
  });

  it('월간 달성률(monthStats.achievementPercent)은 그 달 모든 그룹을 각 100%로 캡한 뒤 평균한다(합산 방식 아님)', () => {
    // 목표 100분씩 3개 플랜: 50%(50분) / 120%(120분, 초과) / 60%(60분) — 서로 다른 날짜에 걸쳐 있어도 월 전체로 합산돼야 한다.
    const groupA = makeRecord({ logicId: 'logic-a', logicName: 'A', totalTargetMinutes: 100, sessions: [makeSession('s-a', 'cat-1', 50)] });
    const groupB = makeRecord({ logicId: 'logic-b', logicName: 'B', totalTargetMinutes: 100, sessions: [makeSession('s-b', 'cat-1', 120)] });
    const groupC = makeRecord({ logicId: 'logic-c', logicName: 'C', totalTargetMinutes: 100, sessions: [makeSession('s-c', 'cat-1', 60)] });
    const recordMap = new Map([
      ['2026-07-01', [groupA]],
      ['2026-07-02', [groupB]],
      ['2026-07-03', [groupC]],
    ]);
    const { result } = renderHook(() => useCalendarMonth(2026, 7, recordMap));

    // 옛 방식(실제분합÷목표분합)이면 (50+120+60)/(100+100+100) = 76.7%로 부풀려진다.
    // 새 방식(캡-평균)은 (50+100+60)/3 = 70%.
    expect(result.current.monthStats.achievementPercent).toBe(70);
    // totalMinutes/totalTarget은 표시용 단순 합계라 캡 없이 그대로다.
    expect(result.current.monthStats.totalMinutes).toBe(230);
    expect(result.current.monthStats.totalTarget).toBe(300);
  });
});

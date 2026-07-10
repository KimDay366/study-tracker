/**
 * 다중 플랜 대응 회귀 테스트 (F6) — DayDetail
 * 플랜 그룹마다 섹션이 반복 렌더링되는지(F3), 그리고 각 그룹의 활동 카드가
 * 그 그룹 자신의 스냅샷을 기준으로 렌더링되는지(다른 그룹과 섞이지 않는지) 검증한다.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayDetail } from '@/components/calendar/DayDetail';
import type { CalendarDayInfo, CalendarGroupInfo } from '@/hooks/useCalendarMonth';
import type { DailyRecord, Session } from '@/types';

function makeSession(id: string, categoryId: string, durationMinutes: number): Session {
  return {
    id,
    categoryId,
    sessionStartTimestamp: new Date('2026-07-07T09:00:00').getTime(),
    sessionEndTimestamp: new Date('2026-07-07T09:00:00').getTime() + durationMinutes * 60000,
    durationMinutes,
    isManuallyEdited: false,
    editedAt: null,
    source: 'timer',
  };
}

function makeGroup(logicId: string, logicName: string, catName: string, catId: string, sessions: Session[]): CalendarGroupInfo {
  const record: DailyRecord = {
    date: '2026-07-07',
    logicId,
    logicSnapshot: {
      name: logicName,
      totalTargetMinutes: 60,
      categories: [{ id: catId, name: catName, colorVar: '--cat-color-01', targetMinutes: 60, targetPercent: 100 }],
    },
    sessions,
    achievementCache: null,
    createdAt: '2026-07-07T09:00:00.000Z',
    updatedAt: '2026-07-07T09:00:00.000Z',
  };
  const totalMinutes = sessions.reduce((s, x) => s + x.durationMinutes, 0);
  return {
    record,
    totalMinutes,
    totalAchievementPercent: (totalMinutes / 60) * 100,
    categoryPercents: [(totalMinutes / 60) * 100],
    rainbowHeart: totalMinutes >= 60,
    rainbowStar: totalMinutes >= 60,
  };
}

describe('DayDetail — 플랜 그룹별 섹션 반복 렌더링 (F3 회귀 방지)', () => {
  it('그룹이 2개면 각 그룹의 플랜명 헤더와 그 그룹 자신의 활동만 렌더링된다', () => {
    const groupA = makeGroup('logic-a', '오전 플랜', '국어', 'cat-a', [makeSession('s1', 'cat-a', 30)]);
    const groupB = makeGroup('logic-b', '오후 플랜', '영어', 'cat-b', [makeSession('s2', 'cat-b', 20)]);
    const info: CalendarDayInfo = { date: '2026-07-07', groups: [groupA, groupB], totalMinutes: 50, allLogicsAchieved: false };

    render(<DayDetail date="2026-07-07" info={info} today="2026-07-08" />);

    // 두 그룹의 플랜명이 모두 섹션 헤더로 표시된다.
    expect(screen.getByText('오전 플랜')).toBeDefined();
    expect(screen.getByText('오후 플랜')).toBeDefined();

    // 각 그룹의 활동은 정확히 1개씩만 렌더링되고, 서로 섞이지 않는다.
    expect(screen.getAllByText('국어')).toHaveLength(1);
    expect(screen.getAllByText('영어')).toHaveLength(1);
  });

  it('그룹이 없으면(빈 배열) "기록 없음" 문구를 보여준다', () => {
    const info: CalendarDayInfo = { date: '2026-07-01', groups: [], totalMinutes: 0, allLogicsAchieved: false };
    render(<DayDetail date="2026-07-01" info={info} today="2026-07-08" />);
    expect(screen.getByText('이 날은 공부 기록이 없어요.')).toBeDefined();
  });

  it('오늘 날짜 + onAddSession이 전달되면 그룹 유무와 무관하게 "+ 기록 직접 추가" 버튼이 보인다', () => {
    const info: CalendarDayInfo = { date: '2026-07-08', groups: [], totalMinutes: 0, allLogicsAchieved: false };
    render(
      <DayDetail date="2026-07-08" info={info} today="2026-07-08" onAddSession={() => {}} />,
    );
    expect(screen.getByRole('button', { name: '+ 기록 직접 추가' })).toBeDefined();
  });

  it('세션 내역 토글은 그룹별로 독립적으로 열리고 닫힌다(같은 활동 id라도 그룹이 다르면 섞이지 않음)', () => {
    // 두 그룹이 활동 id를 우연히 공유하는 극단적 케이스도 안전해야 한다.
    const groupA = makeGroup('logic-a', '플랜A', '공통활동', 'cat-shared', [makeSession('s1', 'cat-shared', 10)]);
    const groupB = makeGroup('logic-b', '플랜B', '공통활동', 'cat-shared', [makeSession('s2', 'cat-shared', 15)]);
    const info: CalendarDayInfo = { date: '2026-07-07', groups: [groupA, groupB], totalMinutes: 25, allLogicsAchieved: false };

    render(<DayDetail date="2026-07-07" info={info} today="2026-07-08" />);

    const toggles = screen.getAllByRole('button', { name: '기록 보기' });
    expect(toggles).toHaveLength(2);

    fireEvent.click(toggles[0]);
    // 그룹A만 펼쳐지고 그룹B는 그대로 닫혀 있어야 한다 — "기록 닫기"가 정확히 1개만 보임
    expect(screen.getAllByRole('button', { name: '기록 닫기' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '기록 보기' })).toHaveLength(1);
  });
});

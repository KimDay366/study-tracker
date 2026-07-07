/**
 * 다중 로직 대응 회귀 테스트 (F6)
 *
 * 버그 배경(설계 문서 multi-logic-redesign.md §0, TodayStudy.tsx 구 L860):
 *   기존 코드는 "오늘 세션 내역"에서 세션의 카테고리명을 찾을 때
 *   `selectedLogic.categories.find(c => c.id === sess.categoryId)` — 즉 "현재 화면에 선택된 로직"
 *   기준으로 찾았다. 하루 중 로직을 바꾸면 이전 로직으로 기록한 세션은 카테고리를 찾지 못해
 *   '알 수 없음'으로 표시됐다.
 *
 * 수정 후에는 각 세션이 실제로 속한 로직 그룹 자신의 logicSnapshot.categories에서 찾으므로,
 * 로직을 바꾼 뒤에도 과거 세션이 자기 로직 이름으로 정확히 표시되어야 한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TodayStudy } from '@/pages/TodayStudy';
import { useTodayStore } from '@/stores/todayStore';
import { useTimerStore } from '@/stores/timerStore';
import { useUIStore } from '@/stores/uiStore';
import type { DailyRecord, StudyLogic } from '@/types';

const LOGIC_A: StudyLogic = {
  id: 'logic-a',
  name: '내신 대비',
  totalTargetMinutes: 60,
  categories: [
    { id: 'cat-a1', name: '국어A', colorVar: '--cat-color-01', targetMinutes: 60, targetPercent: 100 },
  ],
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const LOGIC_B: StudyLogic = {
  id: 'logic-b',
  name: '수능 대비',
  totalTargetMinutes: 60,
  categories: [
    { id: 'cat-b1', name: '영어B', colorVar: '--cat-color-02', targetMinutes: 60, targetPercent: 100 },
  ],
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

/** 오늘 오전엔 로직 B로 공부하다가, 오후에 로직 A로 전환한 상황을 재현 */
const RECORD_B: DailyRecord = {
  date: '2026-07-07',
  logicId: 'logic-b',
  logicSnapshot: { name: '수능 대비', totalTargetMinutes: 60, categories: LOGIC_B.categories },
  sessions: [
    {
      id: 'sess-b1',
      categoryId: 'cat-b1',
      sessionStartTimestamp: new Date('2026-07-07T09:00:00').getTime(),
      sessionEndTimestamp: new Date('2026-07-07T09:30:00').getTime(),
      durationMinutes: 30,
      isManuallyEdited: false,
      editedAt: null,
      source: 'timer',
    },
  ],
  achievementCache: null,
  createdAt: '2026-07-07T09:00:00.000Z',
  updatedAt: '2026-07-07T09:30:00.000Z',
};

const RECORD_A: DailyRecord = {
  date: '2026-07-07',
  logicId: 'logic-a',
  logicSnapshot: { name: '내신 대비', totalTargetMinutes: 60, categories: LOGIC_A.categories },
  sessions: [
    {
      id: 'sess-a1',
      categoryId: 'cat-a1',
      sessionStartTimestamp: new Date('2026-07-07T14:00:00').getTime(),
      sessionEndTimestamp: new Date('2026-07-07T14:20:00').getTime(),
      durationMinutes: 20,
      isManuallyEdited: false,
      editedAt: null,
      source: 'timer',
    },
  ],
  achievementCache: null,
  createdAt: '2026-07-07T14:00:00.000Z',
  updatedAt: '2026-07-07T14:20:00.000Z',
};

// 테스트별로 오늘 그룹 구성을 바꿔 끼울 수 있도록 mock 함수로 분리
// (기본값: 서버가 반환하는 순서(created_at 오름차순) 그대로 — 오전 그룹(B) → 오후 그룹(A))
const mockUseDailyRecord = vi.fn(() => ({ data: [RECORD_B, RECORD_A] }));

vi.mock('@/hooks/query/useLogics', () => ({
  useLogics: () => ({ data: [LOGIC_A, LOGIC_B], isLoading: false, isError: false }),
}));
vi.mock('@/hooks/query/useDailyRecords', () => ({
  useDailyRecord: () => mockUseDailyRecord(),
  useAddSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/query/useSettings', () => ({
  useSettings: () => ({ data: null }),
  usePatchSettings: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/query/useRoutine', () => ({
  useRoutineQuery: () => ({ data: null }),
  useUpsertRoutine: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function renderTodayStudy() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/', element: <TodayStudy /> }], { initialEntries: ['/'] });
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useTimerStore.getState().resetTimer();
  useUIStore.setState({ toasts: [] });
  // 현재 화면에서 선택된 로직 = A (오늘 나중에 전환한 로직)
  useTodayStore.setState({ selectedLogicId: 'logic-a' });
  mockUseDailyRecord.mockReturnValue({ data: [RECORD_B, RECORD_A] });

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('다중 로직 대응 — 오늘 세션 내역 그룹화 (F4 회귀 방지)', () => {
  it('로직을 바꾼 뒤에도 이전 로직 세션이 "알 수 없음"이 아니라 자기 로직의 카테고리명으로 표시된다', () => {
    renderTodayStudy();

    // "오늘 세션 내역" 영역으로 스코프 — 상단 로직 선택기·카테고리 선택 섹션과 텍스트가 겹치지 않도록.
    const history = within(screen.getByRole('region', { name: '오늘 기록 내역' }));

    // 버그 회귀 방지 핵심 단언: '알 수 없음'이 화면에 없어야 한다.
    expect(history.queryByText('알 수 없음')).toBeNull();

    // 오전 로직(B)의 세션은 B의 카테고리명 '영어B'로, 오후 로직(A)의 세션은 A의 카테고리명 '국어A'로 표시된다.
    expect(history.getByText('영어B')).toBeDefined();
    expect(history.getByText('국어A')).toBeDefined();
  });

  it('오늘 로직이 2개 이상이면 그룹 헤더로 로직명을 각각 나눠 보여준다', () => {
    renderTodayStudy();

    const history = within(screen.getByRole('region', { name: '오늘 기록 내역' }));
    expect(history.getByText('수능 대비')).toBeDefined();
    expect(history.getByText('내신 대비')).toBeDefined();
  });

  it('오늘 로직이 1개뿐이어도 그룹 헤더에 로직명이 펼치기 없이 상시 표시된다', () => {
    // 요구사항(2026-07-07 메인 페이지 UI 개선): 로직이 1개뿐인 흔한 케이스에서도
    // 그룹 헤더는 항상 보여야 한다(과거엔 로직이 2개 이상일 때만 표시됐음).
    mockUseDailyRecord.mockReturnValue({ data: [RECORD_A] });
    useTodayStore.setState({ selectedLogicId: 'logic-a' });

    renderTodayStudy();

    const history = within(screen.getByRole('region', { name: '오늘 기록 내역' }));
    expect(history.getByText('내신 대비')).toBeDefined();
  });
});

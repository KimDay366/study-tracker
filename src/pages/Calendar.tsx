import { useState, useCallback, useMemo } from 'react';
import type { Session, DailyRecord } from '@/types';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useCalendarMonth } from '@/hooks/useCalendarMonth';
import {
  useMonthlyRecords, useDailyRecord,
  useAddSession, useUpdateSession, useDeleteSession,
} from '@/hooks/query/useDailyRecords';
import { useWeeklyReviewsDone } from '@/hooks/query/useWeeklyReviews';
import { useLogics } from '@/hooks/query/useLogics';
import { buildLogicSnapshot } from '@/lib/logicSnapshot';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { DayDetail } from '@/components/calendar/DayDetail';
import { SessionModal } from '@/components/common/SessionModal';
import { Dialog } from '@/components/common/Dialog';
import { Modal } from '@/components/common/Modal';
import { useTimerStore } from '@/stores/timerStore';
import { useUIStore } from '@/stores/uiStore';
import styles from './Calendar.module.css';

function getToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** dateStr이 속한 주(월~일)의 월요일 날짜를 반환 */
function getWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const diffToMonday = (d.getDay() + 6) % 7; // 월=0 … 일=6
  d.setDate(d.getDate() - diffToMonday);
  return toYMD(d);
}

export function Calendar() {
  const today = getToday();
  const todayDate = new Date(today + 'T00:00:00');

  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth() + 1);
  // 모바일: 선택 날짜 → 바텀시트 열림 / 태블릿+: 인라인 패널
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const isTabletOrPC = useMediaQuery('(min-width: 768px)');

  // 서버 월간 기록 조회 → recordMap으로 변환해 집계 hook에 주입
  // 다중 로직 대응: 같은 날짜에 로직 그룹이 여러 개 올 수 있으므로 배열로 묶는다.
  const { data: monthRecords, isLoading, isError, refetch } = useMonthlyRecords(year, month);
  const recordMap = useMemo(() => {
    const m = new Map<string, DailyRecord[]>();
    (monthRecords ?? []).forEach((r) => {
      const arr = m.get(r.date) ?? [];
      arr.push(r);
      m.set(r.date, arr);
    });
    return m;
  }, [monthRecords]);

  // 달력에 표시되는 각 주(월~일)의 시작일(월요일) → 주간회고 완료 여부 서버 조회
  // (useCalendarMonth의 행/주 구성과 동일한 오프셋 계산이어야 날짜가 어긋나지 않는다)
  const weekMondays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const lastDay = new Date(year, month, 0);
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
    const list: string[] = [];
    for (let i = 0; i < totalCells; i += 7) {
      list.push(toYMD(new Date(year, month - 1, 1 - startOffset + i)));
    }
    return list;
  }, [year, month]);
  const weeklyReviewDone = useWeeklyReviewsDone(weekMondays);

  const { calendarCells, dayInfoMap, monthStats } =
    useCalendarMonth(year, month, recordMap, weeklyReviewDone);

  // 이번 주(월~일) 기록 보정 허용 범위: 이번 주 월요일 ~ 오늘(미래 제외)
  const thisWeekMonday = useMemo(() => getWeekMonday(today), [today]);
  // 선택한 날짜가 보정 가능 범위 안에 있을 때만 그 날짜로 세션 추가/수정/삭제를 허용한다.
  const editableDate = useMemo(() => {
    if (!selectedDate) return null;
    if (selectedDate > today || selectedDate < thisWeekMonday) return null;
    return selectedDate;
  }, [selectedDate, today, thisWeekMonday]);
  // 실제 뮤테이션·모달에 사용할 대상 날짜 (선택된 날짜가 편집 불가면 오늘로 폴백 — 오늘 세션 추가는 항상 가능해야 하므로)
  const calTargetDate = editableDate ?? today;

  // 대상 날짜의 로직 그룹 배열(다중 로직 대응). 미존재 시 빈 배열.
  const { data: calTodayRecords = [] } = useDailyRecord(calTargetDate);

  // 기록 "직접 추가"의 대상 로직 — QA Minor: 자동으로 "마지막 선택 로직"에 넣지 않고
  // 사용자가 명시적으로 골라야 한다(특히 과거 날짜 추가 시 어느 로직인지 안 보이는 혼란 방지).
  const { data: logics = [] } = useLogics();
  // 선택된 날짜(calTargetDate)에 이미 기록이 있는 로직 id 집합 — 로직 선택 화면에서 "이 날 기록 있음" 표시용.
  const loggedLogicIds = useMemo(
    () => new Set(calTodayRecords.map(r => r.logicId)),
    [calTodayRecords],
  );
  // 기존에 이 날 기록이 있는 로직을 목록 위쪽에 노출 (새 로직 추가도 그대로 고를 수 있음)
  const addLogicPickerList = useMemo(
    () => [...logics].sort((a, b) => Number(loggedLogicIds.has(b.id)) - Number(loggedLogicIds.has(a.id))),
    [logics, loggedLogicIds],
  );

  const [calAddLogicId, setCalAddLogicId] = useState<string | null>(null);
  const [showAddLogicPicker, setShowAddLogicPicker] = useState(false);
  const calAddLogic = useMemo(
    () => logics.find(l => l.id === calAddLogicId) ?? null,
    [logics, calAddLogicId],
  );

  // 세션 뮤테이션 (성공 시 월간/단일 쿼리 무효화 → 즉시 반영)
  const addSessionMut = useAddSession();
  const updateSessionMut = useUpdateSession();
  const deleteSessionMut = useDeleteSession();

  // 스토어
  const timerStatus = useTimerStore(s => s.status);
  const showToast = useUIStore(s => s.showToast);

  // 달력 세션 보정 상태
  const [calSessionModalMode, setCalSessionModalMode] = useState<'add' | 'edit' | null>(null);
  const [calEditTarget, setCalEditTarget] = useState<Session | null>(null);
  const [calDeleteTarget, setCalDeleteTarget] = useState<Session | null>(null);

  // "기록 직접 추가" 버튼 클릭 — 로직이 하나뿐이면 바로 그 로직으로, 이미 이 날짜에 골라둔 로직이 있으면
  // 그걸 재사용, 그 외에는(첫 추가·로직 여러 개) 로직 선택 화면을 먼저 띄운다.
  const handleOpenAddFlow = useCallback(() => {
    if (logics.length === 0) return;
    if (logics.length === 1) {
      setCalAddLogicId(logics[0].id);
      setCalEditTarget(null);
      setCalSessionModalMode('add');
      return;
    }
    if (calAddLogicId && logics.some(l => l.id === calAddLogicId)) {
      setCalEditTarget(null);
      setCalSessionModalMode('add');
      return;
    }
    setShowAddLogicPicker(true);
  }, [logics, calAddLogicId]);

  const handlePickAddLogic = useCallback((logicId: string) => {
    setCalAddLogicId(logicId);
    setShowAddLogicPicker(false);
    setCalEditTarget(null);
    setCalSessionModalMode('add');
  }, []);

  // 수정 대상 세션이 속한 로직 그룹 — categoryId 검증은 그 그룹의 스냅샷 카테고리 기준이므로
  // (§8-4: 다른 로직 카테고리로 변경 불가) 수정 모달에는 반드시 세션 원래 그룹의 카테고리를 보여줘야 한다.
  const calEditTargetGroup = useMemo(
    () => calTodayRecords.find(r => r.sessions.some(s => s.id === calEditTarget?.id)) ?? null,
    [calTodayRecords, calEditTarget],
  );
  // 겹침 검사는 로직과 무관하게 그날 전체 세션을 대상으로 해야 한다(같은 시간에 두 로직을 동시에 할 수는 없으므로).
  const calAllTodaySessions = useMemo(
    () => calTodayRecords.flatMap(r => r.sessions),
    [calTodayRecords],
  );

  const handleCalSessionSave = useCallback((session: Session) => {
    if (calSessionModalMode === 'edit' && calEditTarget) {
      updateSessionMut.mutate(
        {
          date: calTargetDate,
          sessionId: calEditTarget.id,
          body: {
            categoryId: session.categoryId,
            sessionStartTimestamp: session.sessionStartTimestamp,
            sessionEndTimestamp: session.sessionEndTimestamp,
            durationMinutes: session.durationMinutes,
            isManuallyEdited: true,
            editedAt: session.editedAt,
          },
        },
        {
          onSuccess: () => showToast('기록이 저장됐어요.', 'success'),
          onError: () => showToast('기록 저장에 실패했어요.', 'danger'),
        },
      );
    } else {
      if (!calAddLogic) return;
      addSessionMut.mutate(
        {
          date: calTargetDate,
          body: {
            id: session.id,
            categoryId: session.categoryId,
            sessionStartTimestamp: session.sessionStartTimestamp,
            sessionEndTimestamp: session.sessionEndTimestamp,
            durationMinutes: session.durationMinutes,
            source: session.source,
            logicId: calAddLogic.id,
            logicSnapshot: buildLogicSnapshot(calAddLogic),
          },
        },
        {
          onSuccess: () => showToast('기록이 저장됐어요.', 'success'),
          onError: () => showToast('기록 저장에 실패했어요.', 'danger'),
        },
      );
    }
    setCalSessionModalMode(null);
    setCalEditTarget(null);
  }, [calSessionModalMode, calEditTarget, calAddLogic, calTargetDate, addSessionMut, updateSessionMut, showToast]);

  const handleCalDeleteConfirm = useCallback(() => {
    if (!calDeleteTarget) return;
    deleteSessionMut.mutate(
      { date: calTargetDate, sessionId: calDeleteTarget.id },
      {
        onSuccess: () => showToast('기록이 삭제됐어요.', 'success'),
        onError: () => showToast('기록 삭제에 실패했어요.', 'danger'),
      },
    );
    setCalDeleteTarget(null);
  }, [calDeleteTarget, calTargetDate, deleteSessionMut, showToast]);

  const handleMonthChange = useCallback(
    (delta: -1 | 1) => {
      let newMonth = month + delta;
      let newYear = year;
      if (newMonth < 1) {
        newMonth = 12;
        newYear -= 1;
      } else if (newMonth > 12) {
        newMonth = 1;
        newYear += 1;
      }
      setYear(newYear);
      setMonth(newMonth);
      // 월 바뀌면 태블릿 선택 초기화
      if (isTabletOrPC) setSelectedDate(null);
    },
    [year, month, isTabletOrPC],
  );

  const handleSelectDate = useCallback(
    (date: string) => {
      setSelectedDate(date);
      // 날짜가 바뀌면 이전 날짜에서 골라둔 추가 대상 로직은 초기화 — 그 날짜 기준으로 다시 고르게 한다.
      setCalAddLogicId(null);
      if (!isTabletOrPC) {
        setSheetOpen(true);
      }
    },
    [isTabletOrPC],
  );

  const handleCloseSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

  const selectedInfo = selectedDate ? (dayInfoMap.get(selectedDate) ?? null) : null;

  return (
    <>
      {/* 로딩 / 에러 배너 (최초 로드·재조회 실패 시) */}
      {isError ? (
        <div className={`${styles.statusBanner} ${styles.statusError}`}>
          <span>달력을 불러오지 못했어요.</span>
          <button type="button" className={styles.retryButton} onClick={() => refetch()}>
            다시 시도
          </button>
        </div>
      ) : isLoading && !monthRecords ? (
        <div className={styles.statusBanner}>달력을 불러오는 중...</div>
      ) : null}

      {/* 이번 달 달성 진행바 */}
      <div className={styles.monthProgress}>
        <div className={styles.monthProgressLabel}>
          이번 달 달성: {monthStats.achievementPercent.toFixed(1)}%
          <span className={styles.monthProgressSub}>
            {monthStats.totalMinutes}분 / {monthStats.totalTarget}분
          </span>
        </div>
        <div className={styles.monthProgressBar}>
          <div
            className={styles.monthProgressFill}
            style={{ width: `${Math.min(monthStats.achievementPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* 모바일 달력 (~767px) */}
      <div className={styles.mobileCalendar}>
        <CalendarGrid
          year={year}
          month={month}
          cells={calendarCells}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          onMonthChange={handleMonthChange}
        />
      </div>

      {/* 태블릿·PC 2열 레이아웃 (768px+) */}
      <div className={styles.tabletLayout}>
        <div className={styles.calendarCol}>
          <CalendarGrid
            year={year}
            month={month}
            cells={calendarCells}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            onMonthChange={handleMonthChange}
          />
        </div>
        <div className={styles.detailCol}>
          <DayDetail
            date={selectedDate}
            info={selectedInfo}
            today={today}
            onEditSession={editableDate ? (sess) => { setCalEditTarget(sess); setCalSessionModalMode('edit'); } : undefined}
            onDeleteSession={editableDate ? (sess) => setCalDeleteTarget(sess) : undefined}
            onAddSession={editableDate && logics.length > 0 ? handleOpenAddFlow : undefined}
            addLogicName={calAddLogic?.name ?? null}
            onChangeAddLogic={editableDate && logics.length > 1 ? () => setShowAddLogicPicker(true) : undefined}
          />
        </div>
      </div>

      {/* 모바일 바텀시트 */}
      {!isTabletOrPC && sheetOpen && (
        <>
          <div
            className={styles.sheetOverlay}
            onClick={handleCloseSheet}
            aria-hidden="true"
          />
          <div
            className={styles.bottomSheet}
            role="dialog"
            aria-modal="true"
            aria-label="날짜 상세"
          >
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeader}>
              <span />
              <button
                type="button"
                className={styles.sheetClose}
                onClick={handleCloseSheet}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className={styles.sheetBody}>
              <DayDetail
                date={selectedDate}
                info={selectedInfo}
                today={today}
                onEditSession={editableDate ? (sess) => { setCalEditTarget(sess); setCalSessionModalMode('edit'); } : undefined}
                onDeleteSession={editableDate ? (sess) => setCalDeleteTarget(sess) : undefined}
                onAddSession={editableDate && logics.length > 0 ? handleOpenAddFlow : undefined}
                addLogicName={calAddLogic?.name ?? null}
                onChangeAddLogic={editableDate && logics.length > 1 ? () => setShowAddLogicPicker(true) : undefined}
              />
            </div>
          </div>
        </>
      )}

      {/* 로직 선택 화면 — 기록 추가 시 어느 로직에 추가할지 먼저 명시적으로 고른다(QA: 자동 선택 금지) */}
      {showAddLogicPicker && (
        <Modal title="어느 로직에 추가할까요?" onClose={() => setShowAddLogicPicker(false)}>
          <div className={styles.logicPickerList}>
            {addLogicPickerList.map((logic) => (
              <button
                key={logic.id}
                type="button"
                className={styles.logicPickerItem}
                onClick={() => handlePickAddLogic(logic.id)}
              >
                <span className={styles.logicPickerName}>{logic.name}</span>
                {loggedLogicIds.has(logic.id) && (
                  <span className={styles.logicPickerBadge}>이 날 기록 있음</span>
                )}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* 달력 세션 수정/추가 모달 — 수정은 그 세션이 속한 원래 그룹의 카테고리를, 추가는 방금 고른 로직의 카테고리를 사용 */}
      {calSessionModalMode && (calSessionModalMode === 'edit' ? calEditTargetGroup : calAddLogic) && (
        <SessionModal
          mode={calSessionModalMode}
          date={calTargetDate}
          initialSession={calEditTarget}
          categories={
            calSessionModalMode === 'edit'
              ? (calEditTargetGroup?.logicSnapshot.categories ?? [])
              : (calAddLogic?.categories ?? [])
          }
          allSessions={calAllTodaySessions}
          timerStatus={timerStatus}
          onSave={handleCalSessionSave}
          onClose={() => { setCalSessionModalMode(null); setCalEditTarget(null); }}
        />
      )}

      {/* 달력 세션 삭제 다이얼로그 */}
      {calDeleteTarget && (
        <Dialog
          icon="🗑️"
          title="이 기록을 삭제할까요?"
          description="되돌릴 수 없어요."
          cancelLabel="취소"
          confirmLabel="삭제"
          confirmVariant="danger"
          onCancel={() => setCalDeleteTarget(null)}
          onConfirm={handleCalDeleteConfirm}
        />
      )}
    </>
  );
}

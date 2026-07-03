import { useState, useCallback, useMemo } from 'react';
import type { Session, DailyRecord } from '@/types';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useCalendarMonth } from '@/hooks/useCalendarMonth';
import {
  useMonthlyRecords, useDailyRecord,
  useAddSession, useUpdateSession, useDeleteSession,
} from '@/hooks/query/useDailyRecords';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { DayDetail } from '@/components/calendar/DayDetail';
import { SessionModal } from '@/components/common/SessionModal';
import { Dialog } from '@/components/common/Dialog';
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
  const { data: monthRecords, isLoading, isError, refetch } = useMonthlyRecords(year, month);
  const recordMap = useMemo(() => {
    const m = new Map<string, DailyRecord>();
    (monthRecords ?? []).forEach((r) => m.set(r.date, r));
    return m;
  }, [monthRecords]);
  const { calendarCells, dayInfoMap, monthStats } = useCalendarMonth(year, month, recordMap);

  // 오늘 레코드(세션 직접추가/수정의 기준). 미존재 시 null.
  const { data: calTodayRecord = null } = useDailyRecord(today);

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

  const handleCalSessionSave = useCallback((session: Session) => {
    if (!calTodayRecord) return;
    if (calSessionModalMode === 'edit' && calEditTarget) {
      updateSessionMut.mutate(
        {
          date: today,
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
          onSuccess: () => showToast('세션이 저장됐어요.', 'success'),
          onError: () => showToast('세션 저장에 실패했어요.', 'danger'),
        },
      );
    } else {
      addSessionMut.mutate(
        {
          date: today,
          body: {
            id: session.id,
            categoryId: session.categoryId,
            sessionStartTimestamp: session.sessionStartTimestamp,
            sessionEndTimestamp: session.sessionEndTimestamp,
            durationMinutes: session.durationMinutes,
            source: session.source,
            logicId: calTodayRecord.logicId || undefined,
            logicSnapshot: calTodayRecord.logicSnapshot,
          },
        },
        {
          onSuccess: () => showToast('세션이 저장됐어요.', 'success'),
          onError: () => showToast('세션 저장에 실패했어요.', 'danger'),
        },
      );
    }
    setCalSessionModalMode(null);
    setCalEditTarget(null);
  }, [calTodayRecord, calSessionModalMode, calEditTarget, today, addSessionMut, updateSessionMut, showToast]);

  const handleCalDeleteConfirm = useCallback(() => {
    if (!calDeleteTarget) return;
    deleteSessionMut.mutate(
      { date: today, sessionId: calDeleteTarget.id },
      {
        onSuccess: () => showToast('세션이 삭제됐어요.', 'success'),
        onError: () => showToast('세션 삭제에 실패했어요.', 'danger'),
      },
    );
    setCalDeleteTarget(null);
  }, [calDeleteTarget, today, deleteSessionMut, showToast]);

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
            onEditSession={selectedDate === today && calTodayRecord ? (sess) => { setCalEditTarget(sess); setCalSessionModalMode('edit'); } : undefined}
            onDeleteSession={selectedDate === today && calTodayRecord ? (sess) => setCalDeleteTarget(sess) : undefined}
            onAddSession={selectedDate === today && calTodayRecord ? () => { setCalEditTarget(null); setCalSessionModalMode('add'); } : undefined}
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
                onEditSession={selectedDate === today && calTodayRecord ? (sess) => { setCalEditTarget(sess); setCalSessionModalMode('edit'); } : undefined}
                onDeleteSession={selectedDate === today && calTodayRecord ? (sess) => setCalDeleteTarget(sess) : undefined}
                onAddSession={selectedDate === today && calTodayRecord ? () => { setCalEditTarget(null); setCalSessionModalMode('add'); } : undefined}
              />
            </div>
          </div>
        </>
      )}

      {/* 달력 세션 수정/추가 모달 */}
      {calSessionModalMode && calTodayRecord && (
        <SessionModal
          mode={calSessionModalMode}
          date={today}
          initialSession={calEditTarget}
          categories={calTodayRecord.logicSnapshot.categories}
          allSessions={calTodayRecord.sessions}
          timerStatus={timerStatus}
          onSave={handleCalSessionSave}
          onClose={() => { setCalSessionModalMode(null); setCalEditTarget(null); }}
        />
      )}

      {/* 달력 세션 삭제 다이얼로그 */}
      {calDeleteTarget && (
        <Dialog
          icon="🗑️"
          title="이 세션을 삭제할까요?"
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

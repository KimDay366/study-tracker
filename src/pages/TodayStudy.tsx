import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useBlocker } from 'react-router-dom';
import type { Category, Session } from '@/types';
import {
  useTimerStore, loadSessionDraft, clearSessionDraft,
  saveFailedSession, flushFailedSessions,
} from '@/stores/timerStore';
import type { SessionDraft, FailedSessionEntry } from '@/stores/timerStore';
import type { SessionAddInput } from '@/api/daily-records';
import { useTodayStore } from '@/stores/todayStore';
import { useUIStore } from '@/stores/uiStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useLogics } from '@/hooks/query/useLogics';
import { useDailyRecord, useAddSession, useUpdateSession, useDeleteSession } from '@/hooks/query/useDailyRecords';
import { useSettings, usePatchSettings } from '@/hooks/query/useSettings';
import { useRoutineQuery } from '@/hooks/query/useRoutine';
import { formatElapsedTime, isSameLocalDate, getLocalMidnight, getLocalDateString } from '@/lib/calculator/timer';
import { calcAchievementPercent } from '@/lib/calculator/achievement';
import { buildLogicSnapshot } from '@/lib/logicSnapshot';
import { HeartDisplay } from '@/components/common/HeartDisplay';
import { SessionModal } from '@/components/common/SessionModal';
import { Dialog } from '@/components/common/Dialog';
import { generateId } from '@/lib/uuid';
import { formatTimestamp } from '@/hooks/useCalendarMonth';
import { resolveRoutineLogic, getRoutineBannerText } from '@/hooks/useRoutine';
import styles from './TodayStudy.module.css';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function getTodayDateString(): string {
  return getLocalDateString();
}

function formatDateLabel(dateStr: string): { date: string; day: string } {
  const d = new Date(dateStr + 'T00:00:00');
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return {
    date: `${year}년 ${month}월 ${day}일`,
    day: `${DAYS[d.getDay()]}요일`,
  };
}

function getAccumulatedMinutes(sessions: Session[], categoryId: string): number {
  return sessions.filter(s => s.categoryId === categoryId).reduce((acc, s) => acc + s.durationMinutes, 0);
}

function getTotalAccumulatedMinutes(sessions: Session[]): number {
  return sessions.reduce((acc, s) => acc + s.durationMinutes, 0);
}

export function TodayStudy() {
  const isTabletOrPC = useMediaQuery('(min-width: 768px)');

  // 스토어
  const timerStatus = useTimerStore(s => s.status);
  const timerCategoryId = useTimerStore(s => s.categoryId);
  const sessionStartTimestamp = useTimerStore(s => s.sessionStartTimestamp);
  const getElapsedMs = useTimerStore(s => s.getElapsedMs);
  const startTimer = useTimerStore(s => s.startTimer);
  const pauseTimer = useTimerStore(s => s.pauseTimer);
  const resumeTimer = useTimerStore(s => s.resumeTimer);
  const stopTimer = useTimerStore(s => s.stopTimer);
  const restoreFromDraft = useTimerStore(s => s.restoreFromDraft);

  const selectedLogicId = useTodayStore(s => s.selectedLogicId);
  const setSelectedLogicId = useTodayStore(s => s.setSelectedLogicId);

  const showToast = useUIStore(s => s.showToast);
  const bannerVisible = useUIStore(s => s.bannerVisible);
  const setBannerVisible = useUIStore(s => s.setBannerVisible);

  // 서버 데이터 훅
  const { data: logics = [] } = useLogics();
  const todayDateStr = getTodayDateString();
  // 다중 플랜 대응: 오늘의 플랜 그룹 배열(플랜을 바꾸면 그룹이 늘어난다). 빈 배열 = 오늘 기록 없음.
  const { data: todayRecords = [] } = useDailyRecord(todayDateStr);
  const { data: settingsData } = useSettings();
  const { data: routineData } = useRoutineQuery();

  // 뮤테이션 훅 (최상위 선언 — Rules of Hooks)
  const addSessionMutation = useAddSession();
  const updateSessionMutation = useUpdateSession();
  const deleteSessionMutation = useDeleteSession();
  const patchSettingsMutation = usePatchSettings();

  // 로컬 상태
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [sessionModalMode, setSessionModalMode] = useState<'add' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<Session | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [pendingDraft, setPendingDraft] = useState<SessionDraft | null>(null);
  const [showShortSessionDialog, setShowShortSessionDialog] = useState(false);

  // stale closure 방지: 스토어 액션을 ref로 보관
  const getElapsedMsRef = useRef(getElapsedMs);
  getElapsedMsRef.current = getElapsedMs;

  // 이탈 가드: 타이머 진행 중(running OR paused)일 때 앱 내 네비게이션 차단
  const isTimerActive = timerStatus !== 'idle';
  const blocker = useBlocker(isTimerActive);
  // handleStop 최신 참조 (blocker 핸들러에서 stale closure 방지)
  const handleStopRef = useRef<((skipShortCheck?: boolean) => void) | null>(null);

  const { date: dateLabel, day: dayLabel } = formatDateLabel(todayDateStr);

  // 선택된 플랜
  const selectedLogic = logics.find(l => l.id === selectedLogicId) ?? logics[0] ?? null;

  // 현재 선택된 플랜의 오늘 그룹 — 달성률·활동 카드는 이 그룹 스코프로만 계산한다(§8-1: 그룹별 계산, 합산 안 함).
  // 다른 플랜으로 전환한 뒤에도 그 플랜의 과거 그룹은 todayRecords 안에 별도 원소로 그대로 남아있다.
  const todayGroup = todayRecords.find(r => r.logicId === selectedLogic?.id) ?? null;
  // 세션 겹침 검사는 플랜과 무관하게 그날 전체 세션 기준이어야 한다(같은 시간에 두 플랜을 동시에 할 수 없으므로).
  const allTodaySessions = todayRecords.flatMap(r => r.sessions);

  // 초기화: 플랜 미선택 시 첫 번째 플랜 자동 선택
  useEffect(() => {
    if (logics.length === 0) return;
    if (!selectedLogicId || !logics.find(l => l.id === selectedLogicId)) {
      setSelectedLogicId(logics[0].id);
    }
  }, [logics, selectedLogicId, setSelectedLogicId]);

  // 마운트 시 sessionStorage draft 확인 → 복원 여부 Dialog
  useEffect(() => {
    if (timerStatus !== 'idle') return; // 이미 타이머 실행 중이면 무시
    const draft = loadSessionDraft();
    if (draft) setPendingDraft(draft);
  // 마운트 1회만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // beforeunload 이탈 가드: 타이머 진행 중 탭 닫기·새로고침·주소창 이동 시 경고
  useEffect(() => {
    if (!isTimerActive) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isTimerActive]);

  // visibilitychange 복귀 시 elapsedMs 즉시 재계산
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setElapsedMs(getElapsedMsRef.current());
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // stale closure 방지: selectedLogic·저장 관련 값들을 ref로
  const selectedLogicRef = useRef(selectedLogic);
  selectedLogicRef.current = selectedLogic;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const stopTimerRef = useRef(stopTimer);
  stopTimerRef.current = stopTimer;
  // 뮤테이션 ref (setInterval 내부에서 stale closure 방지)
  const addSessionMutationRef = useRef(addSessionMutation);
  addSessionMutationRef.current = addSessionMutation;

  // 마운트 시: 이전에 저장 실패했던 세션(자정분리·수동정지 공통 localStorage 큐)이 있으면 1회 재시도.
  // 각 항목은 실패 시점에 이미 완전한 요청 바디(logicSnapshot 포함)를 담고 있으므로
  // 현재 selectedLogic 상태와 무관하게 그대로 재전송할 수 있다.
  useEffect(() => {
    void (async () => {
      const { recovered } = await flushFailedSessions(
        (date, body) => addSessionMutationRef.current.mutateAsync({ date, body }),
      );
      if (recovered > 0) {
        showToastRef.current(`이전에 저장하지 못했던 기록 ${recovered}건을 복구했어요.`, 'success');
      }
    })();
  // 마운트 1회만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // setInterval: 실행 중일 때만 tick + 자정 분리 감지
  useEffect(() => {
    if (timerStatus !== 'running') {
      setElapsedMs(getElapsedMsRef.current());
      return;
    }
    const id = setInterval(() => {
      const now = Date.now();
      setElapsedMs(getElapsedMsRef.current());

      // 자정 분리 감지 — sessionStartTimestamp가 오늘이 아닌 경우
      const timerState = useTimerStore.getState();
      const start = timerState.sessionStartTimestamp;
      if (start === null) return;
      if (isSameLocalDate(start, now)) return;

      // 자정을 넘겼음 → 분리 저장
      const logic = selectedLogicRef.current;
      const catId = timerState.categoryId;
      if (!logic || !catId) return;

      // 전날: start ~ 자정 직전
      const midnight = getLocalMidnight(now); // 오늘 자정(ms)
      const prevDateStr = getLocalDateString(start);
      const todayStr = getLocalDateString(now);

      const makeSnapshot = () => buildLogicSnapshot(logic);

      // 전날 세션: start ~ 자정 직전. 저장 시간은 화면 표시와 동일하게 '일시정지 제외' 실제 공부시간으로 계산.
      // (전체 실제 경과 - 자정 이후 구간) → 자정 전에 일시정지가 끼어도 전날 기록이 부풀지 않는다.
      // 자정 이후 구간은 현재 running으로 이어온 시간이라 일시정지가 없어 벽시계 = 실제다.
      const todayWallMs = now - midnight;
      const prevDur = Math.floor(Math.max(0, getElapsedMsRef.current() - todayWallMs) / 60000);
      const todayDur = Math.floor(todayWallMs / 60000);

      // 타이머를 오늘 자정부터 새로 시작(세션 분리) — 저장 전에 리셋해 다음 tick이 중복 분리하지 않도록
      useTimerStore.setState({
        sessionStartTimestamp: midnight,
        pauseOffset: 0,
        pausedAt: null,
      });

      // 전날·오늘 세션을 비동기로 저장 (각각 useAddSession().mutateAsync 호출)
      // 두 구간을 서로 독립된 try/catch로 감싸 하나가 실패해도 나머지 구간 저장을 계속 시도한다.
      // (기존엔 하나가 throw하면 나머지 구간은 아예 시도조차 되지 않고 함께 유실됐음)
      void (async () => {
        const failures: FailedSessionEntry[] = [];

        if (prevDur >= 1) {
          const prevBody: SessionAddInput = {
            id: generateId(),
            categoryId: catId,
            sessionStartTimestamp: start,
            sessionEndTimestamp: midnight - 1,
            durationMinutes: prevDur,
            source: 'timer',
            logicId: logic.id,
            logicSnapshot: makeSnapshot(),
          };
          try {
            await addSessionMutationRef.current.mutateAsync({ date: prevDateStr, body: prevBody });
          } catch {
            failures.push({ localId: generateId(), date: prevDateStr, body: prevBody });
          }
        }

        if (todayDur >= 1) {
          const todayBody: SessionAddInput = {
            id: generateId(),
            categoryId: catId,
            sessionStartTimestamp: midnight,
            sessionEndTimestamp: now,
            durationMinutes: todayDur,
            source: 'timer',
            logicId: logic.id,
            logicSnapshot: makeSnapshot(),
          };
          try {
            await addSessionMutationRef.current.mutateAsync({ date: todayStr, body: todayBody });
          } catch {
            failures.push({ localId: generateId(), date: todayStr, body: todayBody });
          }
        }

        if (failures.length > 0) {
          // 저장 실패 시 무음 처리하지 않는다 — 실패한 구간은 로컬 큐에 보존해 다음 접속 때 복구를 시도하고,
          // 정지 버튼 실패 시와 동일하게 사용자에게 실패를 알린다.
          failures.forEach(saveFailedSession);
          showToastRef.current('자정 분리 저장에 실패했어요. 나중에 다시 시도할게요.', 'danger');
        } else {
          showToastRef.current('자정이 지나 기록이 자동으로 분리되었어요.', 'success');
        }
      })();
    }, 1000);
    return () => clearInterval(id);
  // timerStatus 변경 시만 재등록
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerStatus]);

  // 플랜 선택 핸들러
  const handleSelectLogic = useCallback(async (logicId: string) => {
    if (timerStatus !== 'idle') {
      showToast('타이머가 실행 중이에요. 종료 후 변경해 주세요.', 'warning');
      return;
    }
    setSelectedLogicId(logicId);
    try {
      await patchSettingsMutation.mutateAsync({ lastUsedLogicId: logicId });
    } catch {
      // 설정 저장 실패는 UX에 치명적이지 않으므로 조용히 무시
    }
    setSelectorOpen(false);
  }, [timerStatus, showToast, setSelectedLogicId, patchSettingsMutation]);

  // 활동 선택 핸들러
  const handleSelectCategory = useCallback((catId: string) => {
    // 타이머 실행 중 다른 활동 선택은 무시(정지 먼저)
    if (timerStatus !== 'idle' && timerCategoryId !== catId) {
      showToast('먼저 현재 타이머를 정지해 주세요.', 'warning');
      return;
    }
    setSelectedCategoryId(prev => prev === catId ? null : catId);
  }, [timerStatus, timerCategoryId, showToast]);

  // 시작
  const handleStart = useCallback(() => {
    if (!selectedCategoryId) return;
    startTimer(selectedCategoryId);
  }, [selectedCategoryId, startTimer]);

  // 1분 미만 정지 확인 Dialog에서 "정지하고 삭제" 선택
  const handleShortSessionDiscard = useCallback(() => {
    clearSessionDraft();
    stopTimer();
    setElapsedMs(0);
    setShowShortSessionDialog(false);
  }, [stopTimer]);

  // 정지 — 세션 저장 및 achievementCache 갱신
  const handleStop = useCallback(async (skipShortCheck = false) => {
    if (!selectedLogic || !timerCategoryId || sessionStartTimestamp === null) return;

    const now = Date.now();
    // 저장 시간은 화면 표시와 동일하게 '일시정지 제외' 실제 공부 시간으로 계산
    // (벽시계 기준으로 하면 일시정지한 시간까지 포함돼 1분 미만 차단이 뚫리고 기록이 부풀려짐)
    const durationMinutes = Math.floor(getElapsedMsRef.current() / 60000);

    // 1분 미만이고 단순 정지(이탈 시에는 skipShortCheck=true로 조용히 처리)
    if (!skipShortCheck && durationMinutes < 1) {
      // 확인 모달이 떠 있는 동안 카운터가 계속 올라가 보이지 않도록 타이머를 멈춤
      pauseTimer();
      setShowShortSessionDialog(true);
      return;
    }

    // 1분 이상인 경우만 저장
    if (durationMinutes >= 1) {
      const body: SessionAddInput = {
        id: generateId(),
        categoryId: timerCategoryId,
        sessionStartTimestamp,
        sessionEndTimestamp: now,
        durationMinutes,
        source: 'timer',
        logicId: selectedLogic.id,
        logicSnapshot: buildLogicSnapshot(selectedLogic),
      };
      try {
        await addSessionMutation.mutateAsync({ date: todayDateStr, body });
        showToast(`${durationMinutes}분 기록 완료!`, 'success');
      } catch {
        // 자정분리 경로와 동일하게, 저장 실패 시에도 데이터를 폐기하지 않고 로컬 큐에 보존해
        // 다음 접속 때 자동 재시도되도록 한다(Minor-3: 경로 간 일관성 보강). 토스트는 기존 그대로 유지.
        saveFailedSession({ localId: generateId(), date: todayDateStr, body });
        showToast('저장 중 오류가 발생했어요.', 'danger');
        stopTimer();
        setElapsedMs(0);
        return;
      }
    }

    stopTimer();
    setElapsedMs(0);
  }, [
    selectedLogic, timerCategoryId, sessionStartTimestamp,
    todayDateStr, addSessionMutation, stopTimer, pauseTimer, showToast,
  ]);
  // handleStop 최신 참조 갱신
  handleStopRef.current = handleStop;

  // 이탈 가드 모달이 떠 있는 동안에도 카운터가 올라가 보이지 않도록 동결
  useEffect(() => {
    if (blocker.state === 'blocked') pauseTimer();
  }, [blocker.state, pauseTimer]);

  // 재개 — 일시정지 중 자정 경과 시 분리 저장 후 재개
  const handleResume = useCallback(async () => {
    const timerState = useTimerStore.getState();
    const { pausedAt, sessionStartTimestamp: start, categoryId: catId } = timerState;
    if (timerState.status !== 'paused' || pausedAt === null || start === null || !catId) {
      resumeTimer();
      return;
    }

    const now = Date.now();
    if (isSameLocalDate(start, now)) {
      // 같은 날: 일반 재개
      resumeTimer();
      return;
    }

    // 자정을 넘긴 채 일시정지 → 분리 저장
    const logic = selectedLogic;
    if (!logic) {
      resumeTimer();
      return;
    }

    const prevDateStr = getLocalDateString(start);

    const makeSnapshot = () => buildLogicSnapshot(logic);

    // 전날 세션: start ~ pausedAt. 저장 시간은 '일시정지 제외' 실제 공부시간으로 계산.
    // (paused 상태이므로 getElapsedMs가 pausedAt 기준 누적 공부시간을 반환 = 벽시계 부풀림 방지)
    const prevDur = Math.floor(getElapsedMsRef.current() / 60000);

    // 타이머를 재개 시점(now)에서 새 세션으로 리셋
    useTimerStore.setState({
      sessionStartTimestamp: now,
      pauseOffset: 0,
      pausedAt: null,
      status: 'running',
    });

    const prevBody: SessionAddInput = {
      id: generateId(),
      categoryId: catId,
      sessionStartTimestamp: start,
      sessionEndTimestamp: pausedAt,
      durationMinutes: prevDur,
      source: 'timer',
      logicId: logic.id,
      logicSnapshot: makeSnapshot(),
    };

    try {
      await addSessionMutation.mutateAsync({ date: prevDateStr, body: prevBody });
      showToast('자정이 지나 기록이 자동으로 분리되었어요.', 'success');
    } catch {
      // 저장 실패 시 그냥 재개하되(타이머는 이미 running으로 전환됨), 데이터는 유실하지 않도록
      // 로컬 큐에 보존해 다음 접속 때 복구를 시도하고 사용자에게도 실패를 알린다.
      saveFailedSession({ localId: generateId(), date: prevDateStr, body: prevBody });
      showToast('자정 분리 저장에 실패했어요. 나중에 다시 시도할게요.', 'danger');
    }
  }, [selectedLogic, resumeTimer, addSessionMutation, showToast]);

  // Draft 복원 핸들러
  const handleDraftRestore = useCallback(() => {
    if (!pendingDraft) return;
    const catId = pendingDraft.categoryId;
    // 해당 활동이 현재 플랜에 존재하는지 확인
    if (selectedLogic?.categories.find(c => c.id === catId)) {
      setSelectedCategoryId(catId);
      restoreFromDraft(pendingDraft);
    } else {
      showToast('이전 기록의 활동을 찾을 수 없어요.', 'warning');
      clearSessionDraft();
    }
    setPendingDraft(null);
  }, [pendingDraft, selectedLogic, restoreFromDraft, showToast]);

  const handleDraftDiscard = useCallback(() => {
    clearSessionDraft();
    setPendingDraft(null);
  }, []);

  // 세션 저장 (추가/수정 공통)
  const handleSessionSave = useCallback(async (session: Session) => {
    if (!selectedLogic) return;

    try {
      if (sessionModalMode === 'edit' && editTarget) {
        await updateSessionMutation.mutateAsync({
          date: todayDateStr,
          sessionId: editTarget.id,
          body: {
            categoryId: session.categoryId,
            sessionStartTimestamp: session.sessionStartTimestamp,
            sessionEndTimestamp: session.sessionEndTimestamp,
            durationMinutes: session.durationMinutes,
            isManuallyEdited: session.isManuallyEdited,
            editedAt: session.editedAt,
          },
        });
      } else {
        await addSessionMutation.mutateAsync({
          date: todayDateStr,
          body: {
            id: session.id,
            categoryId: session.categoryId,
            sessionStartTimestamp: session.sessionStartTimestamp,
            sessionEndTimestamp: session.sessionEndTimestamp,
            durationMinutes: session.durationMinutes,
            source: session.source,
            logicId: selectedLogic.id,
            logicSnapshot: buildLogicSnapshot(selectedLogic),
          },
        });
      }
    } catch {
      showToast('저장 중 오류가 발생했어요.', 'danger');
      return;
    }

    setSessionModalMode(null);
    setEditTarget(null);
    showToast('기록이 저장됐어요.', 'success');
  }, [selectedLogic, todayDateStr, sessionModalMode, editTarget, addSessionMutation, updateSessionMutation, showToast]);

  // 세션 삭제 확인
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteSessionMutation.mutateAsync({ date: todayDateStr, sessionId: deleteTarget.id });
    } catch {
      showToast('삭제 중 오류가 발생했어요.', 'danger');
      setDeleteTarget(null);
      return;
    }
    setDeleteTarget(null);
    showToast('기록이 삭제됐어요.', 'success');
  }, [deleteTarget, todayDateStr, deleteSessionMutation, showToast]);

  // 달성률 계산 — 현재 선택된 플랜의 그룹(todayGroup) 스코프로만 계산한다(§8-1).
  const sessions = todayGroup?.sessions ?? [];
  const totalAccumulatedMinutes = getTotalAccumulatedMinutes(sessions);
  const totalTarget = selectedLogic?.totalTargetMinutes ?? 0;
  const totalAchievementPct = totalTarget > 0
    ? (todayGroup?.achievementCache?.totalAchievementPercent
        ?? calcAchievementPercent(totalAccumulatedMinutes, totalTarget))
    : 0;
  const allCategoriesDone = selectedLogic
    ? selectedLogic.categories.every(cat => {
        const pct = todayGroup?.achievementCache?.categoryAchievements
          .find(a => a.categoryId === cat.id)?.achievementPercent
          ?? calcAchievementPercent(getAccumulatedMinutes(sessions, cat.id), cat.targetMinutes);
        return pct >= 100;
      })
    : false;
  const isRainbow = totalAchievementPct >= 100;

  const runningCategory = selectedLogic?.categories.find(c => c.id === timerCategoryId) ?? null;
  const elapsedLabel = formatElapsedTime(elapsedMs);
  // 타이머 패널 상단 큰 활동명 — 타이머가 idle이면 방금 선택한 활동, 진행 중이면 실행 중인 활동.
  const panelCategory = timerStatus === 'idle'
    ? (selectedLogic?.categories.find(c => c.id === selectedCategoryId) ?? null)
    : runningCategory;

  // 수정 대상 세션이 실제로 속한 그룹 — categoryId 선택지는 그 그룹의 스냅샷 활동으로 한정해야
  // 서버 검증(§8-4: 다른 플랜 활동으로 변경 불가, 400 SESSION_CATEGORY_INVALID)에 걸리지 않는다.
  const editTargetGroup = editTarget
    ? (todayRecords.find(r => r.sessions.some(s => s.id === editTarget.id)) ?? null)
    : null;

  // 타이머 버튼 렌더 (모바일/PC 공통 플랜, 스타일만 다름)
  const renderTimerButtons = (variant: 'bar' | 'panel') => {
    const btnClass = variant === 'bar' ? styles.timerBtn : styles.timerPanelBtn;
    const startCls = variant === 'bar' ? styles.timerBtnStart : styles.timerPanelBtnStart;
    const pauseCls = variant === 'bar' ? styles.timerBtnPause : styles.timerPanelBtnPause;
    const stopCls  = variant === 'bar' ? styles.timerBtnStop  : styles.timerPanelBtnStop;

    if (timerStatus === 'idle') {
      return (
        <button
          className={`${btnClass} ${startCls}`}
          onClick={handleStart}
          disabled={!selectedCategoryId}
          aria-label="타이머 시작"
        >
          시작
        </button>
      );
    }
    if (timerStatus === 'running') {
      return (
        <>
          <button className={`${btnClass} ${pauseCls}`} onClick={pauseTimer} aria-label="일시정지">
            일시정지
          </button>
          <button className={`${btnClass} ${stopCls}`} onClick={() => void handleStop()} aria-label="타이머 정지">
            정지
          </button>
        </>
      );
    }
    // paused
    return (
      <>
        <button className={`${btnClass} ${startCls}`} onClick={() => void handleResume()} aria-label="타이머 재개">
          재개
        </button>
        <button className={`${btnClass} ${stopCls}`} onClick={() => void handleStop()} aria-label="타이머 정지">
          정지
        </button>
      </>
    );
  };

  // 루틴 배너 계산 (render 시점에 settingsData/routineData 사용)
  const { banner } = resolveRoutineLogic({
    routine: routineData ?? null,
    logics,
    lastUsedLogicId: settingsData?.lastUsedLogicId ?? selectedLogicId,
    // 오늘 어떤 플랜으로든 이미 공부를 시작했으면(그룹이 하나라도 있으면) 루틴 배너를 띄우지 않는다.
    hasExistingRecord: todayRecords.length > 0,
  });
  const bannerText = getRoutineBannerText(banner);

  return (
    <>
      {/* 루틴 배너 */}
      {bannerVisible && bannerText && (
        <div className={styles.routineBanner} role="banner">
          <span>📅</span>
          <span>{bannerText}</span>
          <button
            className={styles.bannerClose}
            onClick={() => setBannerVisible(false)}
            aria-label="배너 닫기"
          >
            ×
          </button>
        </div>
      )}

      {/* 모바일 헤더 */}
      {!isTabletOrPC && (
        <header className={styles.mobileHeader}>
          <div className={styles.logicSelectorWrap}>
            <button
              className={styles.logicSelector}
              aria-label="플랜 선택"
              aria-expanded={selectorOpen}
              onClick={() => setSelectorOpen(o => !o)}
            >
              <span className={styles.logicName}>{selectedLogic?.name ?? '플랜 없음'}</span>
              <span className={styles.logicArrow}>{selectorOpen ? '▴' : '▾'}</span>
            </button>
            {selectorOpen && logics.length > 0 && (
              <div className={styles.logicDropdown} role="listbox" aria-label="플랜 선택 목록">
                {logics.map(l => (
                  <button
                    key={l.id}
                    className={`${styles.logicDropdownItem}${l.id === selectedLogicId ? ` ${styles.logicDropdownItemActive}` : ''}`}
                    role="option"
                    aria-selected={l.id === selectedLogicId}
                    onClick={() => void handleSelectLogic(l.id)}
                  >
                    {l.name}
                    {l.id === selectedLogicId && <span className={styles.logicDropdownCheck}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={styles.todayDate}>
            <div>{dateLabel}</div>
            <div className={styles.todayDateDay}>{dayLabel}</div>
          </div>
        </header>
      )}

      {/* 태블릿/PC 헤더 */}
      {isTabletOrPC && (
        <div className={styles.pageHeader}>
          <div className={styles.pageHeaderLeft}>
            <h1 className={styles.pageTitle}>오늘의 공부</h1>
            <div className={styles.logicSelectorWrap}>
              <button
                className={styles.logicSelector}
                aria-label="플랜 선택"
                aria-expanded={selectorOpen}
                onClick={() => setSelectorOpen(o => !o)}
              >
                <span className={styles.logicName}>{selectedLogic?.name ?? '플랜 없음'}</span>
                <span className={styles.logicArrow}>{selectorOpen ? '▴' : '▾'}</span>
              </button>
              {selectorOpen && logics.length > 0 && (
                <div className={styles.logicDropdown} role="listbox" aria-label="플랜 선택 목록">
                  {logics.map(l => (
                    <button
                      key={l.id}
                      className={`${styles.logicDropdownItem}${l.id === selectedLogicId ? ` ${styles.logicDropdownItemActive}` : ''}`}
                      role="option"
                      aria-selected={l.id === selectedLogicId}
                      onClick={() => void handleSelectLogic(l.id)}
                    >
                      {l.name}
                      {l.id === selectedLogicId && <span className={styles.logicDropdownCheck}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={styles.todayDate}>
            <div>{dateLabel}</div>
            <div className={styles.todayDateDay}>{dayLabel}</div>
          </div>
        </div>
      )}

      <div className={styles.mainContent}>
        {/* ① 달성률 요약 */}
        <section className={styles.achievementSummary} aria-label="전체 달성률">
          <div className={styles.achievementLabel}>전체 달성률</div>
          <div className={styles.achievementPct}>{totalAchievementPct.toFixed(1)}%</div>
          <div className={styles.achievementHearts}>
            <HeartDisplay
              achievementPercent={totalAchievementPct}
              colorVar="--color-primary"
              rainbow={isRainbow}
              size={10}
            />
          </div>
          {isRainbow && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className={styles.rainbowStar}>★</span>
              <span className={styles.specialBadge}>전체 목표 달성!</span>
            </div>
          )}
          {allCategoriesDone && isRainbow && (
            <span className={styles.specialBadge}>전 활동 100% 달성!</span>
          )}
        </section>

        {/* ② 태블릿/PC 타이머 패널 */}
        {isTabletOrPC && (
          <div className={styles.timerPanel} aria-label="타이머">
            {/* 활동을 선택하면(또는 진행 중이면) 상단에 이름을 크게 표시 */}
            {panelCategory && (
              <div className={styles.timerPanelCatNameBig}>{panelCategory.name}</div>
            )}
            {timerStatus === 'idle' ? (
              <>
                <div className={styles.timerPanelIdleMsg}>
                  {selectedCategoryId ? '시작 버튼을 눌러 공부를 시작하세요.' : '활동을 선택해 주세요.'}
                </div>
                <div className={styles.timerPanelElapsed}>00:00:00</div>
                <div className={styles.timerPanelBtns}>
                  {renderTimerButtons('panel')}
                </div>
              </>
            ) : (
              <>
                <div className={styles.timerPanelCategoryLabel}>
                  <div
                    className={styles.timerCatDot}
                    style={{ background: `var(${runningCategory?.colorVar ?? '--color-primary'})` }}
                  />
                  <span className={styles.timerPanelCatName}>
                    {timerStatus === 'running' ? '실행중' : '일시정지'}
                  </span>
                </div>
                {/* PC(1200px+)에서는 이 행이 가로 배치로 바뀌어 버튼이 시간표시 옆에 나란히 놓인다 */}
                <div className={styles.timerPanelActiveRow}>
                  <div className={styles.timerPanelElapsed}>{elapsedLabel}</div>
                  <div className={styles.timerPanelBtns}>
                    {renderTimerButtons('panel')}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ③ 활동 목록 */}
        <section className={styles.categorySection} aria-label="활동 목록">
          {logics.length === 0 ? (
            /* 온보딩: 플랜 없음 */
            <div className={styles.onboarding}>
              <div className={styles.onboardingIcon}>📖</div>
              <p className={styles.onboardingMsg}>
                아직 플랜이 없어요.<br />플랜을 만들어 볼까요?
              </p>
              <Link to="/logics/new" className={styles.onboardingBtn}>
                플랜 만들기
              </Link>
            </div>
          ) : (
          <>
          <div className={styles.sectionTitle}>활동 선택</div>

          {selectedLogic ? (
            selectedLogic.categories.map((cat: Category) => {
              const isSelected = selectedCategoryId === cat.id;
              const isRunning = timerCategoryId === cat.id && timerStatus !== 'idle';
              const accumulatedMin = getAccumulatedMinutes(sessions, cat.id);
              const catPct = todayGroup?.achievementCache?.categoryAchievements
                .find(a => a.categoryId === cat.id)?.achievementPercent
                ?? calcAchievementPercent(accumulatedMin, cat.targetMinutes);
              const isOverachieve = catPct > 100;
              const colorValue = `var(${cat.colorVar})`;

              return (
                <button
                  key={cat.id}
                  className={styles.catCard}
                  onClick={() => handleSelectCategory(cat.id)}
                  aria-pressed={isSelected}
                  aria-label={`${cat.name} 활동 선택`}
                  style={{
                    borderLeftColor: colorValue,
                    // 선택된 카드 외곽선 = 활동 색
                    borderTopColor: isSelected ? colorValue : 'transparent',
                    borderRightColor: isSelected ? colorValue : 'transparent',
                    borderBottomColor: isSelected ? colorValue : 'transparent',
                    boxShadow: isSelected ? 'var(--shadow-lg)' : undefined,
                  }}
                >
                  <div className={styles.catCardTop}>
                    <div className={styles.catLeft}>
                      <div
                        className={styles.catDot}
                        style={{ background: colorValue }}
                      />
                      <span className={styles.catName}>{cat.name}</span>
                    </div>
                    {isRunning && (
                      <span className={styles.runningBadge}>
                        {timerStatus === 'running' ? '▶ 실행중' : '⏸ 일시정지'}
                      </span>
                    )}
                  </div>

                  <div className={styles.catTimeInfo}>
                    목표 {cat.targetMinutes}분 · 오늘 {accumulatedMin}분
                  </div>

                  <div className={styles.catHeartsRow}>
                    <HeartDisplay
                      achievementPercent={catPct}
                      colorVar={cat.colorVar}
                      rainbow={false}
                      size={10}
                    />
                    <span className={styles.catPct}>{catPct.toFixed(1)}%</span>
                  </div>

                  {isOverachieve && (
                    <span className={styles.overachieveBadge}>초과 달성!</span>
                  )}
                </button>
              );
            })
          ) : (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              등록된 플랜이 없어요.
            </p>
          )}
          </>
          )}
        </section>

        {/* 오늘 세션 내역 — 오늘의 모든 플랜 그룹을 플랜별로 나눠 표시(다중 플랜 대응) */}
        {selectedLogic && (
          <section className={styles.sessionHistory} aria-label="오늘 기록 내역">
            <div className={styles.sessionHistoryTitle}>오늘 기록 내역</div>
            {todayRecords.length === 0 ? (
              <div className={styles.sessionEmpty}>오늘 아직 기록이 없어요.</div>
            ) : (
              // PC(1200px+)에서는 이 래퍼가 가로 방향 flex로 바뀌어 플랜 그룹이 좌→우 컬럼으로 나열된다.
              // 모바일/태블릿은 기본값(세로 스택) 그대로 유지.
              <div className={styles.sessionGroupsWrap}>
                {todayRecords.map(group => (
                  <div key={`${group.logicId}-${group.createdAt}`} className={styles.sessionGroupBlock}>
                    {/* 플랜명은 그룹마다 항상(펼치기 없이) 표시 */}
                    <div className={styles.sessionGroupHeader}>
                      {group.logicSnapshot.name ?? '[삭제된 플랜]'}
                    </div>
                    <div className={styles.sessionList}>
                      {group.sessions.map(sess => {
                        // 버그 수정(L860 근본 원인): 현재 화면에 선택된 플랜이 아니라,
                        // 이 세션이 실제로 속한 그룹 자신의 스냅샷 활동에서 찾는다.
                        // → 플랜을 바꾼 뒤에도 과거 세션이 '알 수 없음'으로 표시되지 않는다.
                        const cat = group.logicSnapshot.categories.find(c => c.id === sess.categoryId);
                        return (
                          <div key={sess.id} className={styles.sessionCard}>
                            <div className={styles.sessionCardLeft}>
                              <span
                                className={styles.sessionDot}
                                style={{ background: `var(${cat?.colorVar ?? '--color-primary'})` }}
                              />
                              <span className={styles.sessionCatName}>{cat?.name ?? '알 수 없음'}</span>
                              {sess.source === 'manual' && (
                                <span className={styles.manualBadge}>직접 추가</span>
                              )}
                            </div>
                            <div className={styles.sessionCardCenter}>
                              <span className={styles.sessionTime}>
                                {formatTimestamp(sess.sessionStartTimestamp)} ~ {formatTimestamp(sess.sessionEndTimestamp)}
                              </span>
                              <span className={styles.sessionDur}>{sess.durationMinutes}분</span>
                            </div>
                            <div className={styles.sessionCardActions}>
                              <button
                                type="button"
                                className={styles.sessionActionBtn}
                                onClick={() => { setEditTarget(sess); setSessionModalMode('edit'); }}
                                aria-label="기록 수정"
                              >✏️</button>
                              <button
                                type="button"
                                className={`${styles.sessionActionBtn} ${styles.sessionDeleteBtn}`}
                                onClick={() => setDeleteTarget(sess)}
                                aria-label="기록 삭제"
                              >🗑️</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className={styles.addSessionBtn}
              onClick={() => { setEditTarget(null); setSessionModalMode('add'); }}
            >
              + 기록 직접 추가
            </button>
          </section>
        )}
      </div>

      {/* 세션 수정/추가 모달 — 수정은 세션이 속한 원래 그룹의 활동을, 추가는 현재 선택 플랜의 활동을 사용 */}
      {sessionModalMode && selectedLogic && (
        <SessionModal
          mode={sessionModalMode}
          date={todayDateStr}
          initialSession={editTarget}
          categories={
            sessionModalMode === 'edit'
              ? (editTargetGroup?.logicSnapshot.categories ?? selectedLogic.categories)
              : selectedLogic.categories
          }
          allSessions={allTodaySessions}
          timerStatus={timerStatus}
          onSave={handleSessionSave}
          onClose={() => { setSessionModalMode(null); setEditTarget(null); }}
        />
      )}

      {/* 세션 삭제 다이얼로그 */}
      {deleteTarget && (
        <Dialog
          icon="🗑️"
          title="이 기록을 삭제할까요?"
          description="되돌릴 수 없어요."
          cancelLabel="취소"
          confirmLabel="삭제"
          confirmVariant="danger"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* 새로고침 후 진행 중 세션 복원 다이얼로그 */}
      {pendingDraft && (
        <Dialog
          icon="⏱️"
          title="이전에 진행 중이던 기록이 있어요."
          description="이어서 기록할까요? '폐기'를 선택하면 이전 기록은 삭제돼요."
          cancelLabel="폐기"
          confirmLabel="이어서 기록"
          confirmVariant="primary"
          onCancel={handleDraftDiscard}
          onConfirm={handleDraftRestore}
        />
      )}

      {/* 기능 2: 1분 미만 정지 경고 다이얼로그 */}
      {showShortSessionDialog && (
        <Dialog
          title="1분이 채 안 됐어요"
          description="1분 미만 기록은 저장되지 않아요. 그래도 정지할까요?"
          cancelLabel="공부 계속"
          confirmLabel="정지하고 삭제"
          confirmVariant="danger"
          onCancel={() => { resumeTimer(); setShowShortSessionDialog(false); }}
          onConfirm={handleShortSessionDiscard}
        />
      )}

      {/* 기능 1: 타이머 진행 중 페이지 이탈 경고 다이얼로그 */}
      {blocker.state === 'blocked' && (
        <Dialog
          title="잠깐, 아직 공부 중이에요!"
          description="지금 이동하면 현재 기록이 정지돼요. 1분 이상 기록됐다면 자동으로 저장돼요."
          cancelLabel="머무르기"
          confirmLabel="저장 후 이동"
          confirmVariant="primary"
          onCancel={() => { resumeTimer(); blocker.reset(); }}
          onConfirm={() => {
            void handleStopRef.current?.(true);
            blocker.proceed();
          }}
        />
      )}

      {/* 모바일 하단 고정 타이머 바 */}
      {!isTabletOrPC && (
        <div className={styles.timerBar} aria-label="타이머">
          {timerStatus === 'idle' ? (
            <>
              <div className={styles.timerIdleMsg}>
                {selectedCategoryId ? '시작 버튼을 눌러 공부를 시작하세요.' : '활동을 선택해 주세요.'}
              </div>
              <div className={styles.timerBtns}>
                {renderTimerButtons('bar')}
              </div>
            </>
          ) : (
            <>
              <div className={styles.timerCategoryLabel}>
                <div
                  className={styles.timerCatDot}
                  style={{ background: `var(${runningCategory?.colorVar ?? '--color-primary'})` }}
                />
                <span className={styles.timerCatName}>
                  {runningCategory?.name} · {timerStatus === 'running' ? '실행중' : '일시정지'}
                </span>
              </div>
              <div className={styles.timerElapsed}>{elapsedLabel}</div>
              <div className={styles.timerBtns}>
                {renderTimerButtons('bar')}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

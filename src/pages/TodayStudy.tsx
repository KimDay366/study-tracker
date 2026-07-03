import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useBlocker } from 'react-router-dom';
import type { Category, DailyRecord, Session } from '@/types';
import { useTimerStore, loadSessionDraft, clearSessionDraft } from '@/stores/timerStore';
import type { SessionDraft } from '@/stores/timerStore';
import { useTodayStore } from '@/stores/todayStore';
import { useUIStore } from '@/stores/uiStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { dailyRecordRepo, appSettingsRepo, routineSettingRepo } from '@/lib/storage';
import { useLogics } from '@/hooks/query/useLogics';
import { formatElapsedTime, isSameLocalDate, getLocalMidnight, getLocalDateString } from '@/lib/calculator/timer';
import { calcAchievementPercent } from '@/lib/calculator/achievement';
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

function getAccumulatedMinutes(record: DailyRecord | null, categoryId: string): number {
  if (!record) return 0;
  return record.sessions
    .filter(s => s.categoryId === categoryId)
    .reduce((acc, s) => acc + s.durationMinutes, 0);
}

function getTotalAccumulatedMinutes(record: DailyRecord | null): number {
  if (!record) return 0;
  return record.sessions.reduce((acc, s) => acc + s.durationMinutes, 0);
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
  const todayRecord = useTodayStore(s => s.todayRecord);
  const setSelectedLogicId = useTodayStore(s => s.setSelectedLogicId);
  const setTodayRecord = useTodayStore(s => s.setTodayRecord);

  const showToast = useUIStore(s => s.showToast);
  const bannerVisible = useUIStore(s => s.bannerVisible);
  const setBannerVisible = useUIStore(s => s.setBannerVisible);

  // 로직 목록: 서버(React Query)에서 조회 — 로직 관리/생성과 동일 소스
  const { data: logics = [] } = useLogics();

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

  const todayDateStr = getTodayDateString();
  const { date: dateLabel, day: dayLabel } = formatDateLabel(todayDateStr);

  // 선택된 로직
  const selectedLogic = logics.find(l => l.id === selectedLogicId) ?? logics[0] ?? null;

  // 초기화: 로직 미선택 시 첫 번째 로직 자동 선택
  useEffect(() => {
    if (logics.length === 0) return;
    if (!selectedLogicId || !logics.find(l => l.id === selectedLogicId)) {
      setSelectedLogicId(logics[0].id);
    }
  }, [logics, selectedLogicId, setSelectedLogicId]);

  // 오늘 DailyRecord 로드 (날짜가 바뀌거나 로직이 바뀌면 재로드)
  useEffect(() => {
    if (!selectedLogic) return;
    const existing = dailyRecordRepo.getByDate(todayDateStr);
    if (existing && existing.logicId === selectedLogic.id) {
      setTodayRecord(existing);
    } else if (!existing) {
      // 오늘 레코드 없음 — null로 초기화(정지 후 첫 세션 저장 시 생성)
      setTodayRecord(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLogic?.id, todayDateStr]);

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

  // stale closure 방지: selectedLogic·todayDateStr·저장 관련 값들을 ref로
  const selectedLogicRef = useRef(selectedLogic);
  selectedLogicRef.current = selectedLogic;
  const setTodayRecordRef = useRef(setTodayRecord);
  setTodayRecordRef.current = setTodayRecord;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const stopTimerRef = useRef(stopTimer);
  stopTimerRef.current = stopTimer;

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

      const makeSnapshot = () => ({
        name: logic.name,
        totalTargetMinutes: logic.totalTargetMinutes,
        categories: logic.categories.map(c => ({
          id: c.id, name: c.name, colorVar: c.colorVar,
          targetMinutes: c.targetMinutes, targetPercent: c.targetPercent,
        })),
      });

      const nowIso = new Date().toISOString();

      // 전날 세션: start ~ 자정 직전. 저장 시간은 화면 표시와 동일하게 '일시정지 제외' 실제 공부시간으로 계산.
      // (전체 실제 경과 - 자정 이후 구간) → 자정 전에 일시정지가 끼어도 전날 기록이 부풀지 않는다.
      // 자정 이후 구간은 현재 running으로 이어온 시간이라 일시정지가 없어 벽시계 = 실제다.
      const todayWallMs = now - midnight;
      const prevDur = Math.floor(Math.max(0, getElapsedMsRef.current() - todayWallMs) / 60000);
      if (prevDur >= 1) {
        const prevSession: Session = {
          id: generateId(),
          categoryId: catId,
          sessionStartTimestamp: start,
          sessionEndTimestamp: midnight - 1,
          durationMinutes: prevDur,
          isManuallyEdited: false,
          editedAt: null,
          source: 'timer',
        };
        const prevExisting = dailyRecordRepo.getByDate(prevDateStr);
        const prevRecord: DailyRecord = prevExisting
          ? { ...prevExisting, sessions: [...prevExisting.sessions, prevSession], updatedAt: nowIso }
          : { date: prevDateStr, logicId: logic.id, logicSnapshot: makeSnapshot(), sessions: [prevSession], achievementCache: null, createdAt: nowIso, updatedAt: nowIso };
        try {
          dailyRecordRepo.saveSessionAndUpdateCache(prevRecord);
        } catch {
          // 저장 실패 시 그냥 계속 (MAJ-03 처리와 독립)
        }
      }

      // 오늘 세션: midnight ~ now (타이머 리셋해 새로운 세션으로 이어감, 1분 미만이면 조용히 누락)
      const todayDur = Math.floor(todayWallMs / 60000);
      if (todayDur >= 1) {
        const todaySession: Session = {
          id: generateId(),
          categoryId: catId,
          sessionStartTimestamp: midnight,
          sessionEndTimestamp: now,
          durationMinutes: todayDur,
          isManuallyEdited: false,
          editedAt: null,
          source: 'timer',
        };
        const todayExisting = dailyRecordRepo.getByDate(todayStr);
        const todayRecord: DailyRecord = todayExisting
          ? { ...todayExisting, sessions: [...todayExisting.sessions, todaySession], updatedAt: nowIso }
          : { date: todayStr, logicId: logic.id, logicSnapshot: makeSnapshot(), sessions: [todaySession], achievementCache: null, createdAt: nowIso, updatedAt: nowIso };
        try {
          dailyRecordRepo.saveSessionAndUpdateCache(todayRecord);
        } catch {
          // 저장 실패 시 그냥 계속
        }
      }

      // 타이머를 오늘 자정부터 새로 시작(세션 분리)
      useTimerStore.setState({
        sessionStartTimestamp: midnight,
        pauseOffset: 0,
        pausedAt: null,
      });

      const saved = dailyRecordRepo.getByDate(todayStr);
      setTodayRecordRef.current(saved);
      showToastRef.current('자정이 지나 세션이 자동으로 분리되었어요.', 'success');
    }, 1000);
    return () => clearInterval(id);
  // timerStatus 변경 시만 재등록
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerStatus]);

  // 로직 선택 핸들러
  const handleSelectLogic = useCallback((logicId: string) => {
    if (timerStatus !== 'idle') {
      showToast('타이머가 실행 중이에요. 종료 후 변경해 주세요.', 'warning');
      return;
    }
    setSelectedLogicId(logicId);
    const now = new Date().toISOString();
    const settings = appSettingsRepo.get();
    appSettingsRepo.save({ ...settings, lastUsedLogicId: logicId, updatedAt: now });
    setSelectorOpen(false);
  }, [timerStatus, showToast, setSelectedLogicId]);

  // 카테고리 선택 핸들러
  const handleSelectCategory = useCallback((catId: string) => {
    // 타이머 실행 중 다른 카테고리 선택은 무시(정지 먼저)
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
  const handleStop = useCallback((skipShortCheck = false) => {
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
      const session: Session = {
        id: generateId(),
        categoryId: timerCategoryId,
        sessionStartTimestamp,
        sessionEndTimestamp: now,
        durationMinutes,
        isManuallyEdited: false,
        editedAt: null,
        source: 'timer',
      };

      // 오늘 레코드 생성 또는 갱신
      const existing = dailyRecordRepo.getByDate(todayDateStr);
      const nowIso = new Date().toISOString();
      const updatedRecord: DailyRecord = existing
        ? { ...existing, sessions: [...existing.sessions, session], updatedAt: nowIso }
        : {
            date: todayDateStr,
            logicId: selectedLogic.id,
            logicSnapshot: {
              name: selectedLogic.name,
              totalTargetMinutes: selectedLogic.totalTargetMinutes,
              categories: selectedLogic.categories.map(c => ({
                id: c.id,
                name: c.name,
                colorVar: c.colorVar,
                targetMinutes: c.targetMinutes,
                targetPercent: c.targetPercent,
              })),
            },
            sessions: [session],
            achievementCache: null,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

      try {
        dailyRecordRepo.saveSessionAndUpdateCache(updatedRecord);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        showToast(
          msg === 'QUOTA_EXCEEDED' ? '저장 공간이 가득 찼어요.' : '저장 중 오류가 발생했어요.',
          'danger',
        );
        stopTimer();
        setElapsedMs(0);
        return;
      }

      // 저장 후 캐시 포함 레코드를 다시 로드해 스토어 반영
      const saved = dailyRecordRepo.getByDate(todayDateStr);
      setTodayRecord(saved);
      showToast(`${durationMinutes}분 기록 완료!`, 'success');
    }

    stopTimer();
    setElapsedMs(0);
  }, [
    selectedLogic, timerCategoryId, sessionStartTimestamp,
    todayDateStr, setTodayRecord, stopTimer, pauseTimer, showToast,
  ]);
  // handleStop 최신 참조 갱신
  handleStopRef.current = handleStop;

  // 이탈 가드 모달이 떠 있는 동안에도 카운터가 올라가 보이지 않도록 동결
  useEffect(() => {
    if (blocker.state === 'blocked') pauseTimer();
  }, [blocker.state, pauseTimer]);

  // 재개 — 일시정지 중 자정 경과 시 분리 저장 후 재개
  const handleResume = useCallback(() => {
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
    const nowDateStr = getLocalDateString(now);
    const nowIso = new Date().toISOString();

    const makeSnapshot = () => ({
      name: logic.name,
      totalTargetMinutes: logic.totalTargetMinutes,
      categories: logic.categories.map(c => ({
        id: c.id, name: c.name, colorVar: c.colorVar,
        targetMinutes: c.targetMinutes, targetPercent: c.targetPercent,
      })),
    });

    // 전날 세션: start ~ pausedAt. 저장 시간은 '일시정지 제외' 실제 공부시간으로 계산.
    // (paused 상태이므로 getElapsedMs가 pausedAt 기준 누적 공부시간을 반환 = 벽시계 부풀림 방지)
    const prevDur = Math.floor(getElapsedMsRef.current() / 60000);
    const prevSession: Session = {
      id: generateId(),
      categoryId: catId,
      sessionStartTimestamp: start,
      sessionEndTimestamp: pausedAt,
      durationMinutes: prevDur,
      isManuallyEdited: false,
      editedAt: null,
      source: 'timer',
    };
    const prevExisting = dailyRecordRepo.getByDate(prevDateStr);
    const prevRecord: DailyRecord = prevExisting
      ? { ...prevExisting, sessions: [...prevExisting.sessions, prevSession], updatedAt: nowIso }
      : { date: prevDateStr, logicId: logic.id, logicSnapshot: makeSnapshot(), sessions: [prevSession], achievementCache: null, createdAt: nowIso, updatedAt: nowIso };

    try {
      dailyRecordRepo.saveSessionAndUpdateCache(prevRecord);
    } catch {
      // 저장 실패 시 그냥 재개
    }

    // 타이머를 재개 시점(now)에서 새 세션으로 리셋
    useTimerStore.setState({
      sessionStartTimestamp: now,
      pauseOffset: 0,
      pausedAt: null,
      status: 'running',
    });

    const todaySaved = dailyRecordRepo.getByDate(nowDateStr);
    setTodayRecord(todaySaved);
    showToast('자정이 지나 세션이 자동으로 분리되었어요.', 'success');
  }, [selectedLogic, resumeTimer, setTodayRecord, showToast]);

  // Draft 복원 핸들러
  const handleDraftRestore = useCallback(() => {
    if (!pendingDraft) return;
    const catId = pendingDraft.categoryId;
    // 해당 카테고리가 현재 로직에 존재하는지 확인
    if (selectedLogic?.categories.find(c => c.id === catId)) {
      setSelectedCategoryId(catId);
      restoreFromDraft(pendingDraft);
    } else {
      showToast('이전 세션의 카테고리를 찾을 수 없어요.', 'warning');
      clearSessionDraft();
    }
    setPendingDraft(null);
  }, [pendingDraft, selectedLogic, restoreFromDraft, showToast]);

  const handleDraftDiscard = useCallback(() => {
    clearSessionDraft();
    setPendingDraft(null);
  }, []);

  // 세션 저장 (추가/수정 공통)
  const handleSessionSave = useCallback((session: Session) => {
    if (!selectedLogic) return;
    const existing = dailyRecordRepo.getByDate(todayDateStr);

    try {
      if (sessionModalMode === 'edit' && editTarget) {
        dailyRecordRepo.updateSession(todayDateStr, editTarget.id, session);
      } else {
        // add 모드: record 없으면 신규 생성
        const nowIso = new Date().toISOString();
        const record: DailyRecord = existing ?? {
          date: todayDateStr,
          logicId: selectedLogic.id,
          logicSnapshot: {
            name: selectedLogic.name,
            totalTargetMinutes: selectedLogic.totalTargetMinutes,
            categories: selectedLogic.categories.map(c => ({
              id: c.id, name: c.name, colorVar: c.colorVar,
              targetMinutes: c.targetMinutes, targetPercent: c.targetPercent,
            })),
          },
          sessions: [],
          achievementCache: null,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        dailyRecordRepo.saveSessionAndUpdateCache({ ...record, sessions: [...record.sessions, session] });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      showToast(
        msg === 'QUOTA_EXCEEDED' ? '저장 공간이 가득 찼어요.' : '저장 중 오류가 발생했어요.',
        'danger',
      );
      return;
    }

    const saved = dailyRecordRepo.getByDate(todayDateStr);
    setTodayRecord(saved);
    setSessionModalMode(null);
    setEditTarget(null);
    showToast('세션이 저장됐어요.', 'success');
  }, [selectedLogic, todayDateStr, sessionModalMode, editTarget, setTodayRecord, showToast]);

  // 세션 삭제 확인
  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    try {
      dailyRecordRepo.deleteSession(todayDateStr, deleteTarget.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      showToast(
        msg === 'QUOTA_EXCEEDED' ? '저장 공간이 가득 찼어요.' : '저장 중 오류가 발생했어요.',
        'danger',
      );
      setDeleteTarget(null);
      return;
    }
    const saved = dailyRecordRepo.getByDate(todayDateStr);
    setTodayRecord(saved);
    setDeleteTarget(null);
    showToast('세션이 삭제됐어요.', 'success');
  }, [deleteTarget, todayDateStr, setTodayRecord, showToast]);

  // 달성률 계산
  const totalAccumulatedMinutes = getTotalAccumulatedMinutes(todayRecord);
  const totalTarget = selectedLogic?.totalTargetMinutes ?? 0;
  const totalAchievementPct = totalTarget > 0
    ? (todayRecord?.achievementCache?.totalAchievementPercent
        ?? calcAchievementPercent(totalAccumulatedMinutes, totalTarget))
    : 0;
  const allCategoriesDone = selectedLogic
    ? selectedLogic.categories.every(cat => {
        const pct = todayRecord?.achievementCache?.categoryAchievements
          .find(a => a.categoryId === cat.id)?.achievementPercent
          ?? calcAchievementPercent(getAccumulatedMinutes(todayRecord, cat.id), cat.targetMinutes);
        return pct >= 100;
      })
    : false;
  const isRainbow = totalAchievementPct >= 100;

  const runningCategory = selectedLogic?.categories.find(c => c.id === timerCategoryId) ?? null;
  const elapsedLabel = formatElapsedTime(elapsedMs);

  // 타이머 버튼 렌더 (모바일/PC 공통 로직, 스타일만 다름)
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
          <button className={`${btnClass} ${stopCls}`} onClick={() => handleStop()} aria-label="타이머 정지">
            정지
          </button>
        </>
      );
    }
    // paused
    return (
      <>
        <button className={`${btnClass} ${startCls}`} onClick={handleResume} aria-label="타이머 재개">
          재개
        </button>
        <button className={`${btnClass} ${stopCls}`} onClick={() => handleStop()} aria-label="타이머 정지">
          정지
        </button>
      </>
    );
  };

  return (
    <>
      {/* 루틴 배너 */}
      {bannerVisible && (() => {
        const { banner } = resolveRoutineLogic({
          routine: routineSettingRepo.get(),
          logics,
          lastUsedLogicId: selectedLogicId,
          hasExistingRecord: !!todayRecord,
        });
        const bannerText = getRoutineBannerText(banner);
        if (!bannerText) return null;
        return (
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
        );
      })()}

      {/* 모바일 헤더 */}
      {!isTabletOrPC && (
        <header className={styles.mobileHeader}>
          <div className={styles.logicSelectorWrap}>
            <button
              className={styles.logicSelector}
              aria-label="로직 선택"
              aria-expanded={selectorOpen}
              onClick={() => setSelectorOpen(o => !o)}
            >
              <span className={styles.logicName}>{selectedLogic?.name ?? '로직 없음'}</span>
              <span className={styles.logicArrow}>{selectorOpen ? '▴' : '▾'}</span>
            </button>
            {selectorOpen && logics.length > 0 && (
              <div className={styles.logicDropdown} role="listbox" aria-label="로직 선택 목록">
                {logics.map(l => (
                  <button
                    key={l.id}
                    className={`${styles.logicDropdownItem}${l.id === selectedLogicId ? ` ${styles.logicDropdownItemActive}` : ''}`}
                    role="option"
                    aria-selected={l.id === selectedLogicId}
                    onClick={() => handleSelectLogic(l.id)}
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
                aria-label="로직 선택"
                aria-expanded={selectorOpen}
                onClick={() => setSelectorOpen(o => !o)}
              >
                <span className={styles.logicName}>{selectedLogic?.name ?? '로직 없음'}</span>
                <span className={styles.logicArrow}>{selectorOpen ? '▴' : '▾'}</span>
              </button>
              {selectorOpen && logics.length > 0 && (
                <div className={styles.logicDropdown} role="listbox" aria-label="로직 선택 목록">
                  {logics.map(l => (
                    <button
                      key={l.id}
                      className={`${styles.logicDropdownItem}${l.id === selectedLogicId ? ` ${styles.logicDropdownItemActive}` : ''}`}
                      role="option"
                      aria-selected={l.id === selectedLogicId}
                      onClick={() => handleSelectLogic(l.id)}
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
            <span className={styles.specialBadge}>전 카테고리 100% 달성!</span>
          )}
        </section>

        {/* ② 태블릿/PC 타이머 패널 */}
        {isTabletOrPC && (
          <div className={styles.timerPanel} aria-label="타이머">
            {timerStatus === 'idle' ? (
              <>
                <div className={styles.timerPanelIdleMsg}>
                  {selectedCategoryId ? '시작 버튼을 눌러 공부를 시작하세요.' : '카테고리를 선택해 주세요.'}
                </div>
                <div className={styles.timerPanelElapsed}>00:00:00</div>
              </>
            ) : (
              <>
                <div className={styles.timerPanelCategoryLabel}>
                  <div
                    className={styles.timerCatDot}
                    style={{ background: `var(${runningCategory?.colorVar ?? '--color-primary'})` }}
                  />
                  <span className={styles.timerPanelCatName}>
                    {runningCategory?.name} · {timerStatus === 'running' ? '실행중' : '일시정지'}
                  </span>
                </div>
                <div className={styles.timerPanelElapsed}>{elapsedLabel}</div>
              </>
            )}
            <div className={styles.timerPanelBtns}>
              {renderTimerButtons('panel')}
            </div>
          </div>
        )}

        {/* ③ 카테고리 목록 */}
        <section className={styles.categorySection} aria-label="카테고리 목록">
          {logics.length === 0 ? (
            /* 온보딩: 로직 없음 */
            <div className={styles.onboarding}>
              <div className={styles.onboardingIcon}>📖</div>
              <p className={styles.onboardingMsg}>
                아직 로직이 없어요.<br />로직을 만들어 볼까요?
              </p>
              <Link to="/logics/new" className={styles.onboardingBtn}>
                로직 만들기
              </Link>
            </div>
          ) : (
          <>
          <div className={styles.sectionTitle}>카테고리 선택</div>

          {selectedLogic ? (
            selectedLogic.categories.map((cat: Category) => {
              const isSelected = selectedCategoryId === cat.id;
              const isRunning = timerCategoryId === cat.id && timerStatus !== 'idle';
              const accumulatedMin = getAccumulatedMinutes(todayRecord, cat.id);
              const catPct = todayRecord?.achievementCache?.categoryAchievements
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
                  aria-label={`${cat.name} 카테고리 선택`}
                  style={{
                    borderLeftColor: colorValue,
                    // 선택된 카드 외곽선 = 카테고리 색
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
              등록된 로직이 없어요.
            </p>
          )}
          </>
          )}
        </section>

        {/* 오늘 세션 내역 */}
        {selectedLogic && (
          <section className={styles.sessionHistory} aria-label="오늘 세션 내역">
            <div className={styles.sectionTitle}>오늘 세션 내역</div>
            {!todayRecord || todayRecord.sessions.length === 0 ? (
              <div className={styles.sessionEmpty}>오늘 아직 세션 기록이 없어요.</div>
            ) : (
              <div className={styles.sessionList}>
                {todayRecord.sessions.map(sess => {
                  const cat = selectedLogic.categories.find(c => c.id === sess.categoryId);
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
                          aria-label="세션 수정"
                        >✏️</button>
                        <button
                          type="button"
                          className={`${styles.sessionActionBtn} ${styles.sessionDeleteBtn}`}
                          onClick={() => setDeleteTarget(sess)}
                          aria-label="세션 삭제"
                        >🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              className={styles.addSessionBtn}
              onClick={() => { setEditTarget(null); setSessionModalMode('add'); }}
            >
              + 세션 직접 추가
            </button>
          </section>
        )}
      </div>

      {/* 세션 수정/추가 모달 */}
      {sessionModalMode && selectedLogic && (
        <SessionModal
          mode={sessionModalMode}
          date={todayDateStr}
          initialSession={editTarget}
          categories={selectedLogic.categories}
          allSessions={todayRecord?.sessions ?? []}
          timerStatus={timerStatus}
          onSave={handleSessionSave}
          onClose={() => { setSessionModalMode(null); setEditTarget(null); }}
        />
      )}

      {/* 세션 삭제 다이얼로그 */}
      {deleteTarget && (
        <Dialog
          icon="🗑️"
          title="이 세션을 삭제할까요?"
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
          title="이전에 진행 중이던 세션이 있어요."
          description="이어서 기록할까요? '폐기'를 선택하면 이전 세션은 삭제돼요."
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
          description="지금 이동하면 현재 세션이 정지돼요. 1분 이상 기록됐다면 자동으로 저장돼요."
          cancelLabel="머무르기"
          confirmLabel="이동하고 정지"
          confirmVariant="primary"
          onCancel={() => { resumeTimer(); blocker.reset(); }}
          onConfirm={() => {
            handleStopRef.current?.(true);
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
                {selectedCategoryId ? '시작 버튼을 눌러 공부를 시작하세요.' : '카테고리를 선택해 주세요.'}
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

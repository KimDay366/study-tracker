import { useState } from 'react';
import type { Session } from '@/types';
import { generateId } from '@/lib/uuid';
import { Modal } from './Modal';
import { Timepicker } from './Timepicker';
import styles from './SessionModal.module.css';

interface Props {
  mode: 'add' | 'edit';
  date: string; // YYYY-MM-DD
  initialSession?: Session | null;
  categories: Array<{ id: string; name: string; colorVar: string }>;
  allSessions: Session[]; // 겹침 검사용
  timerStatus: 'idle' | 'running' | 'paused';
  onSave: (session: Session) => void;
  onClose: () => void;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toHM(ts: number): { h: number; m: number } {
  const d = new Date(ts);
  return { h: d.getHours(), m: d.getMinutes() };
}

function toTs(date: string, h: number, m: number): number {
  return new Date(`${date}T${pad(h)}:${pad(m)}:00`).getTime();
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

export function SessionModal({
  mode, date, initialSession, categories, allSessions, timerStatus, onSave, onClose,
}: Props) {
  const now = new Date();
  const defaultStart = initialSession
    ? toHM(initialSession.sessionStartTimestamp)
    : { h: now.getHours(), m: now.getMinutes() };
  const defaultEnd = initialSession
    ? toHM(initialSession.sessionEndTimestamp)
    : (() => {
        const endM = now.getMinutes() + 30;
        return { h: now.getHours() + Math.floor(endM / 60), m: endM % 60 };
      })();

  const [categoryId, setCategoryId] = useState(
    initialSession?.categoryId ?? categories[0]?.id ?? ''
  );
  const [startH, setStartH] = useState(defaultStart.h);
  const [startM, setStartM] = useState(defaultStart.m);
  const [endH, setEndH] = useState(Math.min(defaultEnd.h, 23));
  const [endM, setEndM] = useState(defaultEnd.m % 60);

  const [errorMsg, setErrorMsg] = useState('');
  const [timeError, setTimeError] = useState(false);
  const [overlapWarning, setOverlapWarning] = useState(false);
  const [overlapConfirmed, setOverlapConfirmed] = useState(false);

  const startTs = toTs(date, startH, startM);
  const endTs = toTs(date, endH, endM);
  const durationMinutes = Math.floor((endTs - startTs) / 60000);

  const handleStartChange = (val: string) => {
    const [h, m] = val.split(':').map(Number);
    setStartH(h);
    setStartM(m);
    setErrorMsg('');
    setTimeError(false);
    setOverlapWarning(false);
    setOverlapConfirmed(false);
  };

  const handleEndChange = (val: string) => {
    const [h, m] = val.split(':').map(Number);
    setEndH(h);
    setEndM(m);
    setErrorMsg('');
    setTimeError(false);
    setOverlapWarning(false);
    setOverlapConfirmed(false);
  };

  const handleSave = () => {
    // 1. 타이머 실행 중 차단
    if (timerStatus !== 'idle') {
      setErrorMsg('타이머 실행 중에는 보정을 저장할 수 없어요.');
      return;
    }
    // 2. 종료 <= 시작
    if (endTs <= startTs) {
      setErrorMsg('종료 시각은 시작 시각보다 늦어야 해요.');
      setTimeError(true);
      return;
    }
    // 3. 미래 시각
    if (endTs > Date.now()) {
      setErrorMsg('현재 시각 이후로는 입력할 수 없어요.');
      setTimeError(true);
      return;
    }
    // 4. 겹침 체크 (자신 제외)
    const excludeId = initialSession?.id;
    const hasOverlap = allSessions.some(
      s => s.id !== excludeId && s.sessionStartTimestamp < endTs && s.sessionEndTimestamp > startTs
    );
    if (hasOverlap && !overlapConfirmed) {
      setOverlapWarning(true);
      setOverlapConfirmed(true);
      return;
    }

    const session: Session = {
      id: initialSession?.id ?? generateId(),
      categoryId,
      sessionStartTimestamp: startTs,
      sessionEndTimestamp: endTs,
      durationMinutes,
      isManuallyEdited: true,
      editedAt: new Date().toISOString(),
      source: initialSession?.source ?? 'manual',
    };
    onSave(session);
  };

  return (
    <Modal title={mode === 'edit' ? '기록 수정' : '기록 추가'} onClose={onClose}>
      {/* 활동 */}
      <div className={styles.formGroup}>
        <label className={styles.label}>활동</label>
        <select
          className={styles.categorySelect}
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
        >
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* 시작/종료 시각 */}
      <div className={styles.formGroup}>
        <label className={styles.label}>시간</label>
        <div className={styles.timeRow}>
          <div className={styles.timeCol}>
            <span className={styles.label}>시작</span>
            <Timepicker
              value={`${pad(startH)}:${pad(startM)}`}
              disabled={false}
              onChange={handleStartChange}
              hasError={timeError}
            />
          </div>
          <span className={styles.timeSep}>~</span>
          <div className={styles.timeCol}>
            <span className={styles.label}>종료</span>
            <Timepicker
              value={`${pad(endH)}:${pad(endM)}`}
              disabled={false}
              onChange={handleEndChange}
              hasError={timeError}
            />
          </div>
        </div>
      </div>

      {/* 소요 시간 */}
      <div className={styles.durationDisplay}>
        <span className={styles.durationLabel}>소요 시간:</span>
        <span className={styles.durationValue}>{formatDuration(durationMinutes)}</span>
      </div>

      {/* 경고: 1분 미만 */}
      {durationMinutes > 0 && durationMinutes < 1 && (
        <div className={styles.warnMsg}>
          1분 미만 기록이에요. 저장해도 달성 시간에 반영되지 않아요.
        </div>
      )}

      {/* 경고: 겹침 */}
      {overlapWarning && (
        <div className={styles.warnMsg}>
          다른 기록과 시간이 겹쳐요. 그래도 저장할까요?
        </div>
      )}

      {/* 오류 */}
      {errorMsg && (
        <div className={styles.errorMsg}>{errorMsg}</div>
      )}

      {/* 버튼 */}
      <div className={styles.footerRow}>
        <button type="button" className={styles.btnCancel} onClick={onClose}>취소</button>
        <button type="button" className={styles.btnSave} onClick={handleSave}>
          {overlapWarning ? '그래도 저장' : '저장'}
        </button>
      </div>
    </Modal>
  );
}

import { useState, useCallback, useEffect } from 'react';
import type { RoutineDay, RoutineSetting, StudyLogic } from '@/types';
import { useUIStore } from '@/stores/uiStore';
import { useRoutineQuery, useUpsertRoutine } from '@/hooks/query/useRoutine';
import { useLogics } from '@/hooks/query/useLogics';
import { Timepicker } from '@/components/common/Timepicker';
import styles from './Routine.module.css';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function buildDefaultDays(): Record<string, RoutineDay> {
  const days: Record<string, RoutineDay> = {};
  for (let i = 0; i < 7; i++) {
    const isWeekday = i >= 1 && i <= 5;
    days[String(i)] = {
      enabled: isWeekday,
      time: isWeekday ? '08:30' : null,
      logicId: null,
    };
  }
  return days;
}

function mergeWithDefaults(routine: RoutineSetting | null | undefined): Record<string, RoutineDay> {
  if (routine) return { ...buildDefaultDays(), ...routine.days };
  return buildDefaultDays();
}

interface RoutineRowProps {
  dow: number;
  day: RoutineDay;
  logics: StudyLogic[];
  onChange: (dow: number, patch: Partial<RoutineDay>) => void;
  timeError: boolean;
}

function RoutineRowItem({ dow, day, logics, onChange, timeError }: RoutineRowProps) {
  const dayName = DAY_NAMES[dow];
  const isSunday = dow === 0;
  const isSaturday = dow === 6;

  return (
    <div className={`${styles.routineRow} ${!day.enabled ? styles.routineRowDisabled : ''}`}>
      <div className={styles.routineRowInner}>
        <div className={styles.routineRowTop}>
          <span
            className={`${styles.routineDayName} ${isSunday ? styles.routineDayNameSunday : ''} ${isSaturday ? styles.routineDayNameSaturday : ''}`}
          >
            {dayName}요일
          </span>
          <label className={styles.toggleSwitch} aria-label={`${dayName}요일 활성화`}>
            <input
              type="checkbox"
              checked={day.enabled}
              onChange={e => onChange(dow, { enabled: e.target.checked })}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>

        <div className={styles.routineRowFields}>
          <div>
            <Timepicker
              value={day.time}
              disabled={!day.enabled}
              onChange={time => onChange(dow, { time })}
            />
            {timeError && day.enabled && !day.time && (
              <div className={styles.fieldError}>시간을 입력해 주세요.</div>
            )}
          </div>

          <select
            className={styles.selectLogic}
            value={day.logicId ?? ''}
            disabled={!day.enabled}
            onChange={e => onChange(dow, { logicId: e.target.value || null })}
            aria-label={`${dayName}요일 플랜 선택`}
          >
            {logics.length === 0 ? (
              <option value="" disabled>먼저 플랜을 만들어 주세요.</option>
            ) : (
              <>
                <option value="">플랜 미지정 (최근 사용 플랜 자동 적용)</option>
                {logics.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </>
            )}
          </select>
        </div>
      </div>
    </div>
  );
}

export function Routine() {
  const showToast = useUIStore(s => s.showToast);

  const { data: routineData, isLoading: routineLoading } = useRoutineQuery();
  const { data: logics = [], isLoading: logicsLoading } = useLogics();
  const upsertRoutine = useUpsertRoutine();

  const [days, setDays] = useState<Record<string, RoutineDay>>(buildDefaultDays);
  const [timeErrors, setTimeErrors] = useState<Record<string, boolean>>({});

  // 서버 데이터가 도착하면 폼에 반영
  useEffect(() => {
    setDays(mergeWithDefaults(routineData));
  }, [routineData]);

  const handleDayChange = useCallback((dow: number, patch: Partial<RoutineDay>) => {
    setDays(prev => ({
      ...prev,
      [String(dow)]: { ...prev[String(dow)], ...patch },
    }));
    if ('time' in patch) {
      setTimeErrors(prev => ({ ...prev, [String(dow)]: false }));
    }
  }, []);

  const handleSave = useCallback(async () => {
    const errors: Record<string, boolean> = {};
    let hasError = false;
    for (let i = 0; i < 7; i++) {
      const d = days[String(i)];
      if (d.enabled && !d.time) {
        errors[String(i)] = true;
        hasError = true;
      }
    }
    if (hasError) {
      setTimeErrors(errors);
      return;
    }

    try {
      await upsertRoutine.mutateAsync({ days } as Omit<RoutineSetting, 'updatedAt'>);
      showToast('알림 설정이 저장됐어요.', 'success');
    } catch {
      showToast('저장 중 오류가 발생했어요.', 'danger');
    }
  }, [days, showToast, upsertRoutine]);

  const isLoading = routineLoading || logicsLoading;

  return (
    <div>
      <h1 className={styles.pageTitle}>루틴 설정</h1>

      <div className={styles.alarmBanner}>
        <span className={styles.alarmBannerIcon}>🔔</span>
        <span>실제 푸시 알람은 추후 업데이트 예정이에요. 현재는 앱 접속 시 안내만 제공해요.</span>
      </div>

      <div className={styles.defaultNotice}>
        <span>ℹ️</span>
        <span>기본값: 월~금 08:30, 토·일은 꺼짐</span>
      </div>

      {isLoading ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          불러오는 중...
        </div>
      ) : (
        <div className={styles.routineTable}>
          <div className={styles.routineTableHeader}>
            <span>요일</span>
            <span>활성</span>
            <span>시간</span>
            <span>플랜</span>
          </div>

          {Array.from({ length: 7 }, (_, i) => (
            <RoutineRowItem
              key={i}
              dow={i}
              day={days[String(i)]}
              logics={logics}
              onChange={handleDayChange}
              timeError={!!timeErrors[String(i)]}
            />
          ))}
        </div>
      )}

      <div className={styles.saveArea}>
        <button
          type="button"
          className={styles.btnSave}
          onClick={handleSave}
          disabled={upsertRoutine.isPending || isLoading}
        >
          {upsertRoutine.isPending ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}

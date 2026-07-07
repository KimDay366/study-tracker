import { useState, useEffect, useRef } from 'react';
import styles from './Timepicker.module.css';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
// 1분 단위(00~59) — 기존 5분 단위에서 세분화
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

interface TimepickerProps {
  value: string | null;
  disabled: boolean;
  onChange: (value: string) => void;
  hasError?: boolean;
}

export function Timepicker({ value, disabled, onChange, hasError = false }: TimepickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minListRef = useRef<HTMLDivElement>(null);

  const [selectedHour, setSelectedHour] = useState(value ? value.split(':')[0] : '08');
  const [selectedMin, setSelectedMin] = useState(value ? value.split(':')[1] : '30');
  // 자동 닫힘: 열려 있는 동안 시/분을 각각 한 번이라도 선택했는지 추적 — 둘 다 선택되면 자동으로 닫는다.
  const [hourPicked, setHourPicked] = useState(false);
  const [minPicked, setMinPicked] = useState(false);

  // value prop 변경 시 내부 상태 동기화
  useEffect(() => {
    if (value) {
      setSelectedHour(value.split(':')[0]);
      setSelectedMin(value.split(':')[1]);
    }
  }, [value]);

  // 시/분을 모두 선택 완료하면(disabled 아님) 드롭다운을 자동으로 닫는다.
  // 주의: "열릴 때 hourPicked/minPicked를 리셋"을 별도 effect로 두면, 재오픈 시 이 effect와
  // 아래 effect가 같은 open 변경에 반응해 동시에 실행되면서 리셋 전의 stale true/true 값을
  // 이 effect가 먼저 읽어 즉시 재닫힘시키는 경쟁 상태가 생긴다. 그래서 리셋은 아래 toggleOpen에서
  // open을 true로 바꾸는 것과 "같은" 상태 업데이트 배치 안에서 동기적으로 함께 처리한다.
  useEffect(() => {
    if (open && hourPicked && minPicked) {
      setOpen(false);
    }
  }, [open, hourPicked, minPicked]);

  const toggleOpen = () => {
    if (disabled) return;
    setOpen(prev => {
      const next = !prev;
      if (next) {
        setHourPicked(false);
        setMinPicked(false);
      }
      return next;
    });
  };

  // 외부 클릭 닫기
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // 선택 항목으로 스크롤
  useEffect(() => {
    if (!open) return;
    const hourEl = hourListRef.current?.querySelector(`[data-val="${selectedHour}"]`);
    const minEl = minListRef.current?.querySelector(`[data-val="${selectedMin}"]`);
    hourEl?.scrollIntoView({ block: 'center' });
    minEl?.scrollIntoView({ block: 'center' });
  }, [open, selectedHour, selectedMin]);

  const handleHourSelect = (h: string) => {
    setSelectedHour(h);
    onChange(`${h}:${selectedMin}`);
    setHourPicked(true);
  };

  const handleMinSelect = (m: string) => {
    setSelectedMin(m);
    onChange(`${selectedHour}:${m}`);
    setMinPicked(true);
  };

  const displayText = value ?? '--:--';

  return (
    <div className={styles.timeInputWrap} ref={wrapRef}>
      <div
        className={`${styles.timeDisplay} ${open ? styles.timeDisplayOpen : ''} ${disabled ? styles.timeDisplayDisabled : ''} ${hasError && !disabled ? styles.timeDisplayError : ''}`}
        onClick={toggleOpen}
        role="combobox"
        aria-expanded={open}
        aria-label="시간 선택"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleOpen();
          }
          if (e.key === 'Escape') setOpen(false);
        }}
      >
        <span className={styles.timeDisplayText}>{displayText}</span>
        <span className={styles.timeDisplayIcon}>🕐</span>
      </div>

      {open && !disabled && (
        <div className={styles.timePickerDropdown}>
          <div className={styles.timePickerInner}>
            {/* 시 */}
            <div className={styles.timePickerCol} ref={hourListRef}>
              <div className={styles.timePickerColHeader}>시</div>
              {HOURS.map(h => (
                <div
                  key={h}
                  data-val={h}
                  className={`${styles.timePickerOption} ${h === selectedHour ? styles.timePickerOptionSelected : ''}`}
                  onClick={() => handleHourSelect(h)}
                >
                  {h}
                </div>
              ))}
            </div>
            {/* 분 (1분 단위) */}
            <div className={styles.timePickerCol} ref={minListRef}>
              <div className={styles.timePickerColHeader}>분</div>
              {MINUTES.map(m => (
                <div
                  key={m}
                  data-val={m}
                  className={`${styles.timePickerOption} ${m === selectedMin ? styles.timePickerOptionSelected : ''}`}
                  onClick={() => handleMinSelect(m)}
                >
                  {m}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

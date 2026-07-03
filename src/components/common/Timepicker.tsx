import { useState, useEffect, useRef } from 'react';
import styles from './Timepicker.module.css';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

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

  // value prop 변경 시 내부 상태 동기화
  useEffect(() => {
    if (value) {
      setSelectedHour(value.split(':')[0]);
      setSelectedMin(value.split(':')[1]);
    }
  }, [value]);

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
  };

  const handleMinSelect = (m: string) => {
    setSelectedMin(m);
    onChange(`${selectedHour}:${m}`);
  };

  const displayText = value ?? '--:--';

  return (
    <div className={styles.timeInputWrap} ref={wrapRef}>
      <div
        className={`${styles.timeDisplay} ${open ? styles.timeDisplayOpen : ''} ${disabled ? styles.timeDisplayDisabled : ''} ${hasError && !disabled ? styles.timeDisplayError : ''}`}
        onClick={() => !disabled && setOpen(o => !o)}
        role="combobox"
        aria-expanded={open}
        aria-label="시간 선택"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled) setOpen(o => !o);
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
            {/* 분 (5분 단위) */}
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

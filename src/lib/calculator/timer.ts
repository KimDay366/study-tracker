/**
 * 세션 지속 시간(분) 계산 — Math.floor
 */
export function calcDurationMinutes(
  startTimestamp: number,
  endTimestamp: number,
): number {
  return Math.floor((endTimestamp - startTimestamp) / 60000);
}

/**
 * 두 timestamp 가 다른 날(로컬 기준)인지 확인
 */
export function isSameLocalDate(tsA: number, tsB: number): boolean {
  const a = new Date(tsA);
  const b = new Date(tsB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * timestamp 가 속한 로컬 날짜의 자정(ms) 반환
 * 예: 2026-06-24 23:58 → 2026-06-24 00:00:00.000 (ms)
 */
export function getLocalMidnight(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * timestamp(미지정 시 현재)가 속한 로컬 날짜를 YYYY-MM-DD 문자열로 반환.
 * toISOString()은 UTC 기준이라 UTC+9 환경에서 오전 9시 전 하루가 밀리므로 사용하지 않는다.
 */
export function getLocalDateString(ts?: number): string {
  const d = ts === undefined ? new Date() : new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 경과 시간을 HH:MM:SS 문자열로 변환
 */
export function formatElapsedTime(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

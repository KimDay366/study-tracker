import { apiClient } from './client';
import type { DailyRecord, Session, LogicSnapshot, AchievementCache } from '@/types';

/**
 * 서버 daily-records 응답 타입.
 * 백엔드 DailyRecordResponse와 동일 구조이나, 프론트는 백엔드 패키지를 import하지 않으므로
 * 여기서 로컬 선언한다. 프론트 DailyRecord와의 유일한 차이는 logicId nullability.
 */
interface DailyRecordResponse {
  date: string;
  logicId: string | null;
  logicSnapshot: LogicSnapshot;
  sessions: Session[];
  achievementCache: AchievementCache | null;
  createdAt: string;
  updatedAt: string;
}

/** 서버 응답 → 프론트 DailyRecord. logicId(null)를 빈 문자열로 흡수해 entities 타입 무수정. */
function mapServerRecord(res: DailyRecordResponse): DailyRecord {
  return {
    ...res,
    logicId: res.logicId ?? '',
  };
}

/**
 * 세션 추가 요청 본문 (서버 SessionCreateSchema 대응).
 * 다중 로직 대응(2026-07-07): logicId/logicSnapshot은 항상 필수 — 서버가 (date, logicId) 조합으로
 * 로직 그룹(daily_records 행)을 upsert하므로, 매 요청마다 "이 세션이 어느 로직 소속인지"를 명시해야 한다.
 */
export interface SessionAddInput {
  id: string;
  categoryId: string;
  sessionStartTimestamp: number;
  sessionEndTimestamp: number;
  durationMinutes: number;
  source: 'timer' | 'manual';
  logicId: string;
  logicSnapshot: LogicSnapshot;
}

/** 세션 수정 요청 본문 (서버 SessionUpdateSchema 대응). */
export interface SessionUpdateInput {
  categoryId?: string;
  sessionStartTimestamp?: number;
  sessionEndTimestamp?: number;
  durationMinutes?: number;
  isManuallyEdited?: boolean;
  editedAt?: string | null;
}

/** 월간 기록 조회 — 데이터가 있는 날짜만 배열로 반환. */
export async function fetchMonthlyRecords(year: number, month: number): Promise<DailyRecord[]> {
  const { data } = await apiClient.get<DailyRecordResponse[]>('/daily-records', {
    params: { year, month },
  });
  return data.map(mapServerRecord);
}

/**
 * 단일 날짜 기록 조회 — 다중 로직 대응(2026-07-07): 그 날짜의 로직 그룹 배열을 반환한다.
 * 기록이 없으면 서버가 200 []을 주므로 그대로 빈 배열(기록 없음)로 취급 — 404 분기 없음.
 */
export async function fetchDailyRecord(date: string): Promise<DailyRecord[]> {
  const { data } = await apiClient.get<DailyRecordResponse[]>(`/daily-records/${date}`);
  return data.map(mapServerRecord);
}

export async function addSession(date: string, body: SessionAddInput): Promise<Session> {
  const { data } = await apiClient.post<Session>(`/daily-records/${date}/sessions`, body);
  return data;
}

export async function updateSession(
  date: string,
  sessionId: string,
  body: SessionUpdateInput,
): Promise<Session> {
  const { data } = await apiClient.put<Session>(
    `/daily-records/${date}/sessions/${sessionId}`,
    body,
  );
  return data;
}

export async function deleteSession(date: string, sessionId: string): Promise<void> {
  await apiClient.delete(`/daily-records/${date}/sessions/${sessionId}`);
}

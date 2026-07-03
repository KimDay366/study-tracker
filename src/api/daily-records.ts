import axios from 'axios';
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

/** 세션 추가 요청 본문 (서버 SessionCreateSchema 대응). 첫 세션이면 logicId/logicSnapshot로 레코드 생성. */
export interface SessionAddInput {
  id: string;
  categoryId: string;
  sessionStartTimestamp: number;
  sessionEndTimestamp: number;
  durationMinutes: number;
  source: 'timer' | 'manual';
  logicId?: string;
  logicSnapshot?: LogicSnapshot;
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

/** 단일 날짜 기록 조회 — 미존재(404)는 null로 정규화(기존 getByDate 동작 호환). */
export async function fetchDailyRecord(date: string): Promise<DailyRecord | null> {
  try {
    const { data } = await apiClient.get<DailyRecordResponse>(`/daily-records/${date}`);
    return mapServerRecord(data);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
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

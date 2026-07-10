import axios from 'axios';
import { apiClient } from './client';
import type { WeeklyReview } from '@/types';

/** 주간 정리 upsert 요청 본문 (서버 WeeklyReviewUpsertSchema 대응). */
export interface WeeklyReviewUpsertInput {
  keep: string;
  problem: string;
  try: string;
  pledge: string;
  usedBuiltinQuote: boolean;
  builtinQuoteIndex: number | null;
}

/** 단일 주 회고 조회 — 미존재(404)는 null로 정규화(기존 getByWeekStart 동작 호환). */
export async function fetchWeeklyReview(weekStartDate: string): Promise<WeeklyReview | null> {
  try {
    const { data } = await apiClient.get<WeeklyReview>(`/weekly-reviews/${weekStartDate}`);
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

/** 주간 정리 저장(신규/수정 upsert). */
export async function upsertWeeklyReview(
  weekStartDate: string,
  body: WeeklyReviewUpsertInput,
): Promise<WeeklyReview> {
  const { data } = await apiClient.put<WeeklyReview>(`/weekly-reviews/${weekStartDate}`, body);
  return data;
}

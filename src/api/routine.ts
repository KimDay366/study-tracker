import { apiClient } from './client';
import type { RoutineSetting } from '@/types';

export async function fetchRoutine(): Promise<RoutineSetting | null> {
  try {
    const { data } = await apiClient.get<RoutineSetting>('/routine');
    return data;
  } catch (e: unknown) {
    // 루틴 미설정 상태 → 404 허용
    if ((e as { response?: { status?: number } })?.response?.status === 404) return null;
    throw e;
  }
}

export async function upsertRoutine(setting: Omit<RoutineSetting, 'updatedAt'>): Promise<RoutineSetting> {
  const { data } = await apiClient.put<RoutineSetting>('/routine', setting);
  return data;
}

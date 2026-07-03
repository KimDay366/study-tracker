import { apiClient } from './client';
import type { AppSettings } from '@/types';

export async function fetchSettings(): Promise<AppSettings> {
  const { data } = await apiClient.get<AppSettings>('/settings');
  return data;
}

export interface SettingsPatch {
  autoStartOnCategorySelect?: boolean;
  lastUsedLogicId?: string | null;
  hasSeenOnboarding?: boolean;
  firstLaunchDate?: string | null;
}

export async function patchSettings(patch: SettingsPatch): Promise<AppSettings> {
  const { data } = await apiClient.patch<AppSettings>('/settings', patch);
  return data;
}

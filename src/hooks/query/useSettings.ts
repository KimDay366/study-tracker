import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, patchSettings, type SettingsPatch } from '@/api/settings';

export const SETTINGS_KEY = ['settings'] as const;

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: fetchSettings,
  });
}

export function usePatchSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsPatch) => patchSettings(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

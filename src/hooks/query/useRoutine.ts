import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRoutine, upsertRoutine } from '@/api/routine';
import type { RoutineSetting } from '@/types';

export const ROUTINE_KEY = ['routine'] as const;

export function useRoutineQuery() {
  return useQuery({
    queryKey: ROUTINE_KEY,
    queryFn: fetchRoutine,
  });
}

export function useUpsertRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (setting: Omit<RoutineSetting, 'updatedAt'>) => upsertRoutine(setting),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROUTINE_KEY }),
  });
}

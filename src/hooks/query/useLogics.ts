import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchLogics, fetchLogic, createLogic, updateLogic, deleteLogic,
  type LogicCreateInput, type LogicUpdateInput,
} from '@/api/logics';

export const LOGICS_KEY = ['logics'] as const;

export function useLogics() {
  return useQuery({
    queryKey: LOGICS_KEY,
    queryFn: fetchLogics,
  });
}

export function useLogic(id: string) {
  return useQuery({
    queryKey: [...LOGICS_KEY, id],
    queryFn: () => fetchLogic(id),
    enabled: !!id,
  });
}

export function useCreateLogic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LogicCreateInput) => createLogic(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOGICS_KEY }),
  });
}

export function useUpdateLogic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: LogicUpdateInput }) => updateLogic(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOGICS_KEY }),
  });
}

export function useDeleteLogic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLogic(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOGICS_KEY }),
  });
}

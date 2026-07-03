import { apiClient } from './client';
import type { StudyLogic, Category } from '@/types';

export interface LogicCreateInput {
  name: string;
  totalTargetMinutes: number;
  categories: Omit<Category, 'id'>[];
}

export interface LogicUpdateInput {
  name: string;
  totalTargetMinutes: number;
  categories: Category[];
}

export async function fetchLogics(): Promise<StudyLogic[]> {
  const { data } = await apiClient.get<StudyLogic[]>('/logics');
  return data;
}

export async function fetchLogic(id: string): Promise<StudyLogic> {
  const { data } = await apiClient.get<StudyLogic>(`/logics/${id}`);
  return data;
}

export async function createLogic(input: LogicCreateInput): Promise<StudyLogic> {
  const { data } = await apiClient.post<StudyLogic>('/logics', input);
  return data;
}

export async function updateLogic(id: string, input: LogicUpdateInput): Promise<StudyLogic> {
  const { data } = await apiClient.put<StudyLogic>(`/logics/${id}`, input);
  return data;
}

export async function deleteLogic(id: string): Promise<void> {
  await apiClient.delete(`/logics/${id}`);
}

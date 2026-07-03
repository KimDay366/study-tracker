import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DailyRecord } from '@/types';

interface TodayState {
  selectedLogicId: string | null;
  todayRecord: DailyRecord | null;
  // Actions
  setSelectedLogicId: (logicId: string | null) => void;
  setTodayRecord: (record: DailyRecord | null) => void;
  reset: () => void;
}

export const useTodayStore = create<TodayState>()(
  persist(
    (set) => ({
      selectedLogicId: null,
      todayRecord: null,

      setSelectedLogicId: (logicId) => set({ selectedLogicId: logicId }),
      setTodayRecord: (record) => set({ todayRecord: record }),
      reset: () => set({ selectedLogicId: null, todayRecord: null }),
    }),
    {
      name: 'st_today_ui',
      partialize: (state) => ({ selectedLogicId: state.selectedLogicId }),
    }
  )
);

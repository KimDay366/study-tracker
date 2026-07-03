import { create } from 'zustand';
import type { ToastMessage, ToastType } from '@/types';
import { generateId } from '@/lib/uuid';

function detectPrivateMode(): boolean {
  try {
    localStorage.setItem('__pm_test__', '1');
    localStorage.removeItem('__pm_test__');
    return false;
  } catch {
    return true;
  }
}

interface UIState {
  toasts: ToastMessage[];
  bannerVisible: boolean;
  isPrivateMode: boolean;
  // Actions
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;
  setBannerVisible: (visible: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  bannerVisible: true,
  isPrivateMode: detectPrivateMode(),

  showToast: (message, type = 'default') => {
    const id = generateId();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    // 4초 후 자동 소멸
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  setBannerVisible: (visible) => set({ bannerVisible: visible }),
}));

import { create } from 'zustand';
import type { AuthUser } from '@/api/auth';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  setAuthenticated: (user: AuthUser) => void;
  setUnauthenticated: () => void;
  setLoading: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  user: null,
  setAuthenticated: (user) => set({ status: 'authenticated', user }),
  setUnauthenticated: () => set({ status: 'unauthenticated', user: null }),
  setLoading: () => set({ status: 'loading' }),
}));

import { create } from 'zustand';
import { getCurrentSession } from '@/services/auth';
import { logDataError } from '@/services/errors';

type AuthState = {
  userId: string | null;
  initialized: boolean;
  initialize: () => Promise<void>;
  setUserId: (userId: string | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  initialized: false,
  initialize: async () => {
    try {
      const session = await getCurrentSession();
      set({ userId: session?.user.id ?? null, initialized: true });
    } catch (error) {
      logDataError('initialize auth', error);
      set({ userId: null, initialized: true });
    }
  },
  setUserId: (userId) => set({ userId, initialized: true }),
}));

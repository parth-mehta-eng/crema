import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { logDataError } from '@/services/errors';
import { getUserFavorites, setUserFavorite } from '@/services/favorites';

type FavoritesState = {
  favorites: string[];
  guestFavorites: string[];
  userId: string | null;
  hydrated: boolean;
  toggleFavorite: (recipeId: string) => void;
  setSessionUser: (userId: string | null) => Promise<void>;
  finishHydration: () => void;
};

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      guestFavorites: [],
      userId: null,
      hydrated: false,
      toggleFavorite: (recipeId) => {
        const previous = get().favorites;
        const saved = !previous.includes(recipeId);
        const next = saved ? [...previous, recipeId] : previous.filter((id) => id !== recipeId);
        const userId = get().userId;

        if (!userId) {
          set({ favorites: next, guestFavorites: next });
          return;
        }

        set({ favorites: next });
        void setUserFavorite(userId, recipeId, saved).catch((error) => {
          logDataError('update favorite', error);
          if (get().userId === userId) set({ favorites: previous });
        });
      },
      setSessionUser: async (userId) => {
        if (!userId) {
          set((state) => ({ userId: null, favorites: state.guestFavorites }));
          return;
        }

        set({ userId });
        try {
          const favorites = await getUserFavorites(userId);
          if (get().userId === userId) set({ favorites });
        } catch (error) {
          logDataError('load favorites', error);
        }
      },
      finishHydration: () =>
        set((state) => ({
          hydrated: true,
          favorites: state.userId ? state.favorites : state.guestFavorites,
        })),
    }),
    {
      name: 'crema-favorites',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ guestFavorites: state.guestFavorites }),
      migrate: (persisted, version) => {
        const previous = persisted as Partial<FavoritesState>;
        if (version < 2 && previous.favorites) {
          return { ...previous, guestFavorites: previous.favorites };
        }
        return previous;
      },
      onRehydrateStorage: () => (state) => state?.finishHydration(),
    },
  ),
);

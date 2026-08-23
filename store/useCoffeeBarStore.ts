import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { logDataError } from '@/services/errors';
import {
  getUserInventory,
  setUserEquipment,
  setUserIngredient,
} from '@/services/inventory';

const defaultIngredients = [
  'espresso',
  'oat-milk',
  'milk',
  'ice',
  'brown-sugar',
  'cinnamon',
  'vanilla',
  'salt',
];
const defaultEquipment = ['espresso-machine', 'milk-frother', 'shaker'];

type CoffeeBarState = {
  ingredients: string[];
  equipment: string[];
  guestIngredients: string[];
  guestEquipment: string[];
  preferences: string[];
  userId: string | null;
  hydrated: boolean;
  toggleIngredient: (ingredientId: string) => void;
  toggleEquipment: (equipmentId: string) => void;
  togglePreference: (preferenceId: string) => void;
  setSessionUser: (userId: string | null) => Promise<void>;
  finishHydration: () => void;
};

function toggleItem(items: string[], itemId: string) {
  return items.includes(itemId) ? items.filter((id) => id !== itemId) : [...items, itemId];
}

export const useCoffeeBarStore = create<CoffeeBarState>()(
  persist(
    (set, get) => ({
      ingredients: defaultIngredients,
      equipment: defaultEquipment,
      guestIngredients: defaultIngredients,
      guestEquipment: defaultEquipment,
      preferences: [],
      userId: null,
      hydrated: false,
      toggleIngredient: (ingredientId) => {
        const previous = get().ingredients;
        const next = toggleItem(previous, ingredientId);
        const selected = next.includes(ingredientId);
        const userId = get().userId;

        if (!userId) {
          set({ ingredients: next, guestIngredients: next });
          return;
        }

        set({ ingredients: next });
        void setUserIngredient(userId, ingredientId, selected).catch((error) => {
          logDataError('update ingredient inventory', error);
          if (get().userId === userId) set({ ingredients: previous });
        });
      },
      toggleEquipment: (equipmentId) => {
        const previous = get().equipment;
        const next = toggleItem(previous, equipmentId);
        const selected = next.includes(equipmentId);
        const userId = get().userId;

        if (!userId) {
          set({ equipment: next, guestEquipment: next });
          return;
        }

        set({ equipment: next });
        void setUserEquipment(userId, equipmentId, selected).catch((error) => {
          logDataError('update equipment inventory', error);
          if (get().userId === userId) set({ equipment: previous });
        });
      },
      togglePreference: (preferenceId) =>
        set((state) => ({ preferences: toggleItem(state.preferences, preferenceId) })),
      setSessionUser: async (userId) => {
        if (!userId) {
          set((state) => ({
            userId: null,
            ingredients: state.guestIngredients,
            equipment: state.guestEquipment,
          }));
          return;
        }

        set({ userId });
        try {
          const inventory = await getUserInventory(userId);
          if (get().userId === userId) set(inventory);
        } catch (error) {
          logDataError('load inventory', error);
        }
      },
      finishHydration: () =>
        set((state) => ({
          hydrated: true,
          ingredients: state.userId ? state.ingredients : state.guestIngredients,
          equipment: state.userId ? state.equipment : state.guestEquipment,
        })),
    }),
    {
      name: 'crema-coffee-bar',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        guestIngredients: state.guestIngredients,
        guestEquipment: state.guestEquipment,
        preferences: state.preferences,
      }),
      migrate: (persisted, version) => {
        const previous = persisted as Partial<CoffeeBarState>;
        if (version < 2) {
          return {
            ...previous,
            guestIngredients: previous.ingredients ?? defaultIngredients,
            guestEquipment: previous.equipment ?? defaultEquipment,
          };
        }
        return previous;
      },
      onRehydrateStorage: () => (state) => state?.finishHydration(),
    },
  ),
);

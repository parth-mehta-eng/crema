import { create } from 'zustand';
import { recipes as localRecipes } from '@/data/recipes';
import { getRecipes } from '@/services/recipes/repository';
import type { Recipe } from '@/types/recipe';

type RecipeState = {
  recipes: Recipe[];
  status: 'idle' | 'loading' | 'ready';
  source: 'supabase' | 'cache' | 'local';
  error: string | null;
  loadRecipes: () => Promise<void>;
};

export const useRecipesStore = create<RecipeState>((set) => ({
  recipes: localRecipes,
  status: 'idle',
  source: 'local',
  error: null,
  loadRecipes: async () => {
    set({ status: 'loading' });
    const result = await getRecipes();
    set({ ...result, status: 'ready' });
  },
}));

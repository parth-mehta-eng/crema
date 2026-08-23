import AsyncStorage from '@react-native-async-storage/async-storage';
import { recipes as localRecipes } from '@/data/recipes';
import { supabase } from '@/lib/supabase';
import type { Recipe } from '@/types/recipe';
import { getDataErrorMessage, logDataError } from '@/services/errors';
import { mapRecipeRow, type RecipeRow } from './mapper';
import { filterRecipes, type RecipeFilter } from './search';

const RECIPE_CACHE_KEY = 'crema-recipe-cache-v1';
const recipeSelect = `
  id, slug, name, subtitle, inspiration, description, image_url, image_alt, minutes, prep_minutes,
  difficulty, temperature, servings, cup_size, tags, category, featured, sweetness, strength, caffeine_mg, calories,
  recipe_ingredients(position, quantity, unit, note, optional, display_name, ingredients(id, name)),
  recipe_equipment(position, equipment(id, name)),
  recipe_steps(position, instruction, timer_seconds),
  published_recipe_collections(recipe_collections(title))
`;

export type RecipeDataResult = {
  recipes: Recipe[];
  source: 'supabase' | 'cache' | 'local';
  error: string | null;
};

async function readCache(): Promise<Recipe[] | null> {
  try {
    const cached = await AsyncStorage.getItem(RECIPE_CACHE_KEY);
    return cached ? (JSON.parse(cached) as Recipe[]) : null;
  } catch (error) {
    logDataError('read recipe cache', error);
    return null;
  }
}

async function writeCache(recipes: Recipe[]) {
  try {
    await AsyncStorage.setItem(RECIPE_CACHE_KEY, JSON.stringify(recipes));
  } catch (error) {
    logDataError('write recipe cache', error);
  }
}

function mapRows(rows: unknown): Recipe[] {
  return ((rows ?? []) as RecipeRow[]).map(mapRecipeRow);
}

async function fallback(error: unknown): Promise<RecipeDataResult> {
  logDataError('load recipes', error);
  const cached = await readCache();
  const retained = cached && cached.length > 0 ? cached : localRecipes;
  return {
    recipes: retained,
    source: cached && cached.length > 0 ? 'cache' : 'local',
    error: getDataErrorMessage(error, 'Recipes could not be refreshed.'),
  };
}

export async function getRecipes(): Promise<RecipeDataResult> {
  if (!supabase) return { recipes: localRecipes, source: 'local', error: null };

  try {
    const { data, error } = await supabase
      .from('recipes')
      .select(recipeSelect)
      .eq('published', true)
      .order('name');
    if (error) throw error;
    const recipes = mapRows(data);
    await writeCache(recipes);
    return { recipes, source: 'supabase', error: null };
  } catch (error) {
    return fallback(error);
  }
}

export async function searchRecipes(
  query: string,
  filter: RecipeFilter | null,
  retainedRecipes: Recipe[],
): Promise<RecipeDataResult> {
  if (!supabase) {
    return { recipes: filterRecipes(retainedRecipes, query, filter), source: 'local', error: null };
  }

  try {
    const { data: matches, error: searchError } = await supabase.rpc('search_recipes', {
      p_search_text: query,
      p_filter: filter,
    });
    if (searchError) throw searchError;

    const typedMatches = (matches ?? []) as Array<{ recipe_id: string; rank: number }>;
    const ids: string[] = typedMatches.map((match) => match.recipe_id);
    if (!ids.length) return { recipes: [], source: 'supabase', error: null };

    const { data, error } = await supabase
      .from('recipes')
      .select(recipeSelect)
      .in('id', ids)
      .eq('published', true);
    if (error) throw error;
    const byId = new Map(mapRows(data).map((recipe) => [recipe.id, recipe]));
    return {
      recipes: ids.flatMap<Recipe>((id) => {
        const recipe = byId.get(id);
        return recipe ? [recipe] : [];
      }),
      source: 'supabase',
      error: null,
    };
  } catch (error) {
    logDataError('search recipes', error);
    return {
      recipes: filterRecipes(retainedRecipes, query, filter),
      source: 'cache',
      error: getDataErrorMessage(error, 'Search could not be refreshed.'),
    };
  }
}

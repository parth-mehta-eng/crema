import { supabase } from '@/lib/supabase';
import { formatDateKey, selectDailyBrewRecipeId } from '@/lib/daily-brew';
import type { Recipe } from '@/types/recipe';
import { getDataErrorMessage, logDataError } from '@/services/errors';
import { mapRecipeRow, type RecipeRow } from '@/services/recipes/mapper';

const recipeSelect = `
  id, slug, name, subtitle, inspiration, description, image_url, image_alt, minutes, prep_minutes,
  difficulty, temperature, servings, cup_size, tags, category, featured, sweetness, strength, caffeine_mg, calories,
  recipe_ingredients(position, quantity, unit, note, optional, display_name, ingredients(id, name)),
  recipe_equipment(position, equipment(id, name)),
  recipe_steps(position, instruction, timer_seconds),
  published_recipe_collections(recipe_collections(title))
`;

export type DailyBrewResult = {
  recipe: Recipe | null;
  error: string | null;
};

/** Placeholder-marker image URLs never count as "approved" for Daily Brew eligibility. */
function hasApprovedImage(imageUrl: string) {
  return Boolean(imageUrl) && imageUrl !== 'crema://placeholder';
}

export async function getDailyBrew(referenceDate: Date = new Date()): Promise<DailyBrewResult> {
  if (!supabase) return { recipe: null, error: null };

  try {
    const { data, error } = await supabase.from('recipes').select('id, image_url').eq('published', true).order('id');
    if (error) throw error;

    const candidates = (data ?? []).map((row) => ({
      id: row.id as string,
      hasApprovedImage: hasApprovedImage(row.image_url as string),
    }));
    const dateKey = formatDateKey(referenceDate);
    const pickedId = selectDailyBrewRecipeId(candidates, dateKey);
    if (!pickedId) return { recipe: null, error: null };

    const { data: recipeRow, error: recipeError } = await supabase
      .from('recipes')
      .select(recipeSelect)
      .eq('id', pickedId)
      .eq('published', true)
      .maybeSingle();
    if (recipeError) throw recipeError;
    if (!recipeRow) return { recipe: null, error: null };

    return { recipe: mapRecipeRow(recipeRow as unknown as RecipeRow), error: null };
  } catch (error) {
    logDataError('load daily brew', error);
    return { recipe: null, error: getDataErrorMessage(error, 'Daily Brew could not be loaded.') };
  }
}

import { supabase } from '@/lib/supabase';

export async function getUserFavorites(userId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('favorites')
    .select('recipe_id')
    .eq('user_id', userId);
  if (error) throw error;
  return [...new Set((data ?? []).map((item) => item.recipe_id))];
}

export async function setUserFavorite(userId: string, recipeId: string, saved: boolean) {
  if (!supabase) return;

  if (saved) {
    const { error } = await supabase
      .from('favorites')
      .upsert(
        { user_id: userId, recipe_id: recipeId },
        { onConflict: 'user_id,recipe_id', ignoreDuplicates: true },
      );
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('recipe_id', recipeId);
  if (error) throw error;
}

import { supabase } from '@/lib/supabase';
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

export type Collection = {
  id: string;
  title: string;
  description: string;
  recipeCount: number;
};

export type CollectionsResult = {
  collections: Collection[];
  error: string | null;
};

export type CollectionRecipesResult = {
  collection: Collection | null;
  recipes: Recipe[];
  error: string | null;
};

/**
 * Curated collections shown in the mobile app, in the order they should appear on the collection
 * list screen. ids/titles must match `recipe_collections` in the database (see
 * supabase/migrations/20260822010000_recipe_authoring.sql).
 */
export const CURATED_COLLECTIONS = [
  { id: 'coffee-shop-inspired', title: 'Coffee Shop Inspired' },
  { id: 'espresso-classics', title: 'Espresso Classics' },
  { id: 'around-the-world', title: 'Around the World' },
  { id: 'crema-originals', title: 'Crema Originals' },
  { id: 'iced-favorites', title: 'Iced Favorites' },
  { id: 'five-minute-coffees', title: 'Five-Minute Coffees' },
  { id: 'beginner-friendly', title: 'Beginner Friendly' },
  { id: 'seasonal-favorites', title: 'Seasonal Favorites' },
] as const;

/** Home shows a subset of collections as scrollable sections, in this order. */
export const HOME_COLLECTION_TITLES = [
  'Coffee Shop Inspired',
  'Espresso Classics',
  'Around the World',
  'Seasonal Favorites',
] as const;

export async function getCollections(): Promise<CollectionsResult> {
  if (!supabase) return { collections: [], error: null };

  try {
    const [collectionsRes, countsRes] = await Promise.all([
      supabase.from('recipe_collections').select('id, title, description, sort_order').eq('active', true).order('sort_order'),
      supabase.from('published_recipe_collections').select('collection_id, recipes!inner(published)').eq('recipes.published', true),
    ]);
    if (collectionsRes.error) throw collectionsRes.error;
    if (countsRes.error) throw countsRes.error;

    const counts = new Map<string, number>();
    for (const row of (countsRes.data ?? []) as Array<{ collection_id: string }>) {
      counts.set(row.collection_id, (counts.get(row.collection_id) ?? 0) + 1);
    }

    const collections = (collectionsRes.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      recipeCount: counts.get(row.id) ?? 0,
    }));

    return { collections, error: null };
  } catch (error) {
    logDataError('load collections', error);
    return { collections: [], error: getDataErrorMessage(error, 'Collections could not be loaded.') };
  }
}

export async function getRecipesByCollection(collectionId: string): Promise<CollectionRecipesResult> {
  if (!supabase) return { collection: null, recipes: [], error: null };

  try {
    const { data: collectionRow, error: collectionError } = await supabase
      .from('recipe_collections')
      .select('id, title, description')
      .eq('id', collectionId)
      .eq('active', true)
      .maybeSingle();
    if (collectionError) throw collectionError;
    if (!collectionRow) return { collection: null, recipes: [], error: null };

    const { data: memberships, error: membershipError } = await supabase
      .from('published_recipe_collections')
      .select('recipe_id, recipes!inner(published)')
      .eq('collection_id', collectionId)
      .eq('recipes.published', true);
    if (membershipError) throw membershipError;

    const ids = (memberships ?? []).map((row) => row.recipe_id as string);
    if (!ids.length) {
      return { collection: { ...collectionRow, recipeCount: 0 }, recipes: [], error: null };
    }

    const { data, error } = await supabase.from('recipes').select(recipeSelect).in('id', ids).eq('published', true).order('name');
    if (error) throw error;
    const recipes = ((data ?? []) as unknown as RecipeRow[]).map(mapRecipeRow);

    return {
      collection: { ...collectionRow, recipeCount: recipes.length },
      recipes,
      error: null,
    };
  } catch (error) {
    logDataError('load collection recipes', error);
    return { collection: null, recipes: [], error: getDataErrorMessage(error, 'This collection could not be loaded.') };
  }
}

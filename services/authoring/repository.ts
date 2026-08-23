import { supabase } from '@/lib/supabase';
import { runAdminAction } from '@/services/admin';
import type { AuthoringDraft, DraftEquipment, DraftIngredient, DraftStep } from './domain';

export type IngredientCatalogItem = {
  id: string;
  name: string;
  canonicalName: string;
  category: string;
  aliases: string[];
  defaultUnit: string | null;
  active: boolean;
};

export type EquipmentCatalogItem = { id: string; name: string };
export type TagCatalogItem = { id: string; name: string; active: boolean };
export type CollectionCatalogItem = { id: string; title: string; description: string; sortOrder: number; active: boolean };
export type AuthoringCatalog = {
  ingredients: IngredientCatalogItem[];
  equipment: EquipmentCatalogItem[];
  tags: TagCatalogItem[];
  collections: CollectionCatalogItem[];
  existingSlugs: Array<{ slug: string; recipeId: string }>;
};

type DraftRow = Record<string, unknown> & {
  id: string;
  recipe_draft_ingredients?: Array<Record<string, unknown>>;
  recipe_draft_steps?: Array<Record<string, unknown> & { recipe_draft_step_ingredients?: Array<{ draft_ingredient_id: string }> }>;
  recipe_draft_equipment?: Array<Record<string, unknown>>;
  recipe_draft_tags?: Array<{ tag_id: string }>;
  recipe_draft_collections?: Array<{ collection_id: string }>;
};

const authoringSelect = `
  *,
  recipe_draft_ingredients(*),
  recipe_draft_steps(*, recipe_draft_step_ingredients(draft_ingredient_id)),
  recipe_draft_equipment(*),
  recipe_draft_tags(tag_id),
  recipe_draft_collections(collection_id)
`;

function requireClient() {
  if (!supabase) throw new Error('Configure Supabase before opening Recipe Authoring.');
  return supabase;
}

function byPosition(left: { position: number }, right: { position: number }) {
  return left.position - right.position;
}

function numberOrNull(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function mapDraft(row: DraftRow): AuthoringDraft {
  const ingredients: DraftIngredient[] = (row.recipe_draft_ingredients ?? []).map((item) => ({
    id: String(item.id), ingredientId: String(item.ingredient_id), displayName: String(item.display_name ?? ''),
    quantity: Number(item.quantity), unit: String(item.unit), preparationNote: String(item.preparation_note ?? ''),
    optional: Boolean(item.optional), substitutionNotes: String(item.substitution_notes ?? ''), position: Number(item.position),
  })).sort(byPosition);
  const steps: DraftStep[] = (row.recipe_draft_steps ?? []).map((item) => ({
    id: String(item.id), instruction: String(item.instruction), timerSeconds: numberOrNull(item.timer_seconds),
    tip: String(item.tip ?? ''), position: Number(item.position),
    ingredientRowIds: (item.recipe_draft_step_ingredients ?? []).map((join) => join.draft_ingredient_id),
  })).sort(byPosition);
  const equipment: DraftEquipment[] = (row.recipe_draft_equipment ?? []).map((item) => ({
    equipmentId: String(item.equipment_id), optional: Boolean(item.optional),
    alternativeNote: String(item.alternative_note ?? ''), position: Number(item.position),
  })).sort(byPosition);
  return {
    id: row.id, proposedTitle: String(row.proposed_title ?? ''), slug: String(row.slug ?? ''),
    description: String(row.description ?? ''), inspirationLabel: String(row.inspiration_label ?? ''),
    sourceName: String(row.source_name ?? ''), sourceUrl: String(row.source_url ?? ''),
    collectionIds: (row.recipe_draft_collections ?? []).map((item) => item.collection_id),
    status: String(row.status) as AuthoringDraft['status'], featured: Boolean(row.featured), tested: Boolean(row.tested),
    category: String(row.category ?? ''), temperature: String(row.temperature ?? ''), difficulty: String(row.difficulty ?? ''),
    prepMinutes: Number(row.prep_minutes ?? 0), totalMinutes: Number(row.total_minutes ?? 0), servings: Number(row.servings ?? 0),
    cupSize: String(row.cup_size ?? '12 oz'), sweetness: numberOrNull(row.sweetness), strength: numberOrNull(row.strength),
    caffeineMg: numberOrNull(row.caffeine_mg), calories: numberOrNull(row.calories),
    heroImageUrl: String(row.hero_image_url ?? ''), heroImagePath: String(row.hero_image_path ?? ''),
    heroImageAlt: String(row.hero_image_alt ?? ''), heroImageMime: String(row.hero_image_mime ?? ''),
    heroImageBytes: numberOrNull(row.hero_image_bytes), placeholderApproved: Boolean(row.placeholder_approved),
    needsTesting: Boolean(row.needs_testing), flavorNotes: Array.isArray(row.flavor_notes) ? row.flavor_notes.map(String) : [],
    ingredients, steps, equipment, tagIds: (row.recipe_draft_tags ?? []).map((item) => item.tag_id),
    publishedRecipeId: row.published_recipe_id ? String(row.published_recipe_id) : null, version: Number(row.version ?? 1),
  };
}

export async function loadAuthoringDraft(draftId: string): Promise<{ draft: AuthoringDraft; catalog: AuthoringCatalog }> {
  const client = requireClient();
  const [draftResult, ingredientsResult, equipmentResult, tagsResult, collectionsResult, slugsResult] = await Promise.all([
    client.from('recipe_drafts').select(authoringSelect).eq('id', draftId).single(),
    client.from('ingredients').select('id,name,canonical_name,category,aliases,default_unit,active').order('name'),
    client.from('equipment').select('id,name').order('name'),
    client.from('recipe_tags').select('id,name,active').order('name'),
    client.from('recipe_collections').select('id,title,description,sort_order,active').order('sort_order'),
    client.from('recipes').select('id,slug'),
  ]);
  const error = draftResult.error ?? ingredientsResult.error ?? equipmentResult.error ?? tagsResult.error ?? collectionsResult.error ?? slugsResult.error;
  if (error) throw error;
  return {
    draft: mapDraft(draftResult.data as unknown as DraftRow),
    catalog: {
      ingredients: (ingredientsResult.data ?? []).map((item) => ({ id: item.id, name: item.name, canonicalName: item.canonical_name, category: item.category, aliases: item.aliases, defaultUnit: item.default_unit, active: item.active })),
      equipment: equipmentResult.data ?? [], tags: tagsResult.data ?? [],
      collections: (collectionsResult.data ?? []).map((item) => ({ id: item.id, title: item.title, description: item.description, sortOrder: item.sort_order, active: item.active })),
      existingSlugs: (slugsResult.data ?? []).map((item) => ({ slug: item.slug, recipeId: item.id })),
    },
  };
}

export async function saveAuthoringDraft(draft: AuthoringDraft): Promise<number> {
  const result = await runAdminAction({ action: 'save-authoring-draft', draft, expectedVersion: draft.version ?? 1 });
  return Number(result);
}

export async function transitionAuthoringDraft(draftId: string, status: 'draft' | 'tested' | 'ready' | 'archived') {
  return runAdminAction({ action: 'transition-authoring-draft', draftId, status });
}

export async function publishAuthoringDraft(draftId: string) {
  return runAdminAction({ action: 'publish-authoring-draft', draftId });
}

export async function unpublishAuthoringDraft(draftId: string) {
  return runAdminAction({ action: 'unpublish-authoring-draft', draftId });
}

export async function duplicateAuthoringDraft(draftId: string) {
  return runAdminAction({ action: 'duplicate-authoring-draft', draftId }) as Promise<{ id: string }>;
}

export async function uploadRecipeImage(draftId: string, uri: string, mimeType: string, extension: string) {
  const client = requireClient();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  const response = await fetch(uri);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('Recipe images must be 5 MB or smaller.');
  const path = `${draftId}/hero-${Date.now()}.${extension.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
  const { error } = await client.storage.from('recipe-images').upload(path, bytes, { contentType: mimeType, upsert: false });
  if (error) throw error;
  const { data } = client.storage.from('recipe-images').getPublicUrl(path);
  return { path, url: data.publicUrl, mimeType, bytes: bytes.byteLength };
}

export async function removeRecipeImage(path: string) {
  if (!path) return;
  const client = requireClient();
  const { error } = await client.storage.from('recipe-images').remove([path]);
  if (error) throw error;
}

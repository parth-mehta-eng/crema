import { supabase } from '@/lib/supabase';
import type { AuthoringDraft } from '@/services/authoring/domain';

export type AdminSource = {
  id: string;
  name: string;
  slug: string;
  base_url: string;
  menu_url: string;
  enabled: boolean;
  parser_type: 'json_ld' | 'generic' | 'custom';
  cooldown_minutes: number;
  last_imported_at: string | null;
};

export type AdminImportRun = {
  id: string;
  source_id: string;
  status: 'running' | 'succeeded' | 'partial' | 'failed' | 'skipped';
  started_at: string;
  completed_at: string | null;
  discovered_count: number;
  new_count: number;
  duplicate_count: number;
  updated_count: number;
  failed_count: number;
  error_message: string | null;
  coffee_sources: { name: string } | null;
};

export type AdminDiscoveredDrink = {
  id: string;
  source_id: string;
  external_name: string;
  external_description: string;
  source_url: string;
  category: string;
  temperature: string;
  flavor_notes: string[];
  mentioned_ingredients: string[];
  status: 'new' | 'reviewed' | 'ignored' | 'converted';
  discovered_at: string;
  coffee_sources: { name: string } | null;
};

export type ImageStatus = 'missing' | 'placeholder' | 'approved';
export type AttributionStatus = 'not_required' | 'required' | 'complete' | 'incomplete';
export type ValidationStatus = 'incomplete' | 'valid' | 'invalid';

export type AdminRecipeDraft = {
  id: string;
  discovered_drink_id: string | null;
  proposed_title: string;
  inspiration_label: string;
  source_name: string;
  source_url: string;
  description: string;
  category: string;
  temperature: string;
  flavor_notes: string[];
  suggested_ingredients: string[];
  suggested_equipment: string[];
  suggested_steps: string[];
  needs_testing: boolean;
  status: 'draft' | 'tested' | 'ready' | 'published' | 'archived';
  tested: boolean;
  slug: string | null;
  updated_at: string;
  published_recipe_id: string | null;
  difficulty: string | null;
  prep_minutes: number | null;
  servings: number | null;
  hero_image_url: string | null;
  placeholder_approved: boolean;
  image_status: ImageStatus;
  attribution_status: AttributionStatus;
  validation_status: ValidationStatus;
  content_notes: string | null;
  last_reviewed_at: string | null;
  recipe_draft_ingredients?: Array<{ id: string }>;
  recipe_draft_steps?: Array<{ id: string; instruction: string }>;
  recipe_draft_equipment?: Array<{ equipment_id: string }>;
  recipe_draft_collections?: Array<{ collection_id: string; recipe_collections: { title: string } | null }>;
  created_at: string;
};

export type AdminDashboardData = {
  sources: AdminSource[];
  runs: AdminImportRun[];
  drinks: AdminDiscoveredDrink[];
  drafts: AdminRecipeDraft[];
  ingredients: Array<{ id: string; name: string; canonical_name: string; category: string; aliases: string[]; default_unit: string | null; active: boolean }>;
  collections: Array<{ id: string; title: string; description: string; sort_order: number; active: boolean }>;
};

export type AdminAction =
  | { action: 'import-source'; sourceId: string }
  | { action: 'update-source-enabled'; sourceId: string; enabled: boolean }
  | { action: 'convert-drink'; drinkId: string }
  | { action: 'update-drink-status'; drinkId: string; status: 'reviewed' | 'ignored' }
  | { action: 'update-draft-status'; draftId: string; status: 'draft' | 'tested' | 'ready' | 'archived' }
  | {
      action: 'save-draft';
      draftId: string;
      proposedTitle: string;
      description: string;
      suggestedIngredients: string[];
      suggestedEquipment: string[];
      suggestedSteps: string[];
    }
  | { action: 'save-authoring-draft'; draft: AuthoringDraft; expectedVersion: number }
  | { action: 'transition-authoring-draft'; draftId: string; status: 'draft' | 'tested' | 'ready' | 'archived' }
  | { action: 'publish-authoring-draft'; draftId: string }
  | { action: 'unpublish-authoring-draft'; draftId: string }
  | { action: 'duplicate-authoring-draft'; draftId: string }
  | { action: 'save-ingredient'; ingredient: { id: string; name: string; canonicalName: string; category: string; aliases: string[]; defaultUnit: string | null; active: boolean } }
  | { action: 'save-collection'; collection: { id: string; title: string; description: string; sortOrder: number; active: boolean } };

function requireSupabase() {
  if (!supabase) throw new Error('Configure Supabase before opening the admin workflow.');
  return supabase;
}

export async function getAdminAccess() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return {
    signedIn: Boolean(data.user),
    isAdmin: data.user?.app_metadata?.role === 'admin',
  };
}

export async function signInAdmin(email: string, password: string) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  if (data.user?.app_metadata?.role !== 'admin') {
    await client.auth.signOut();
    throw new Error('This account does not have Coffee Discovery admin access.');
  }
  return data.user;
}

export async function signOutAdmin() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function loadAdminDashboard(): Promise<AdminDashboardData> {
  const client = requireSupabase();
  const [sources, runs, drinks, drafts, ingredients, collections] = await Promise.all([
    client.from('coffee_sources').select('*').order('name'),
    client.from('menu_import_runs').select('*, coffee_sources(name)').order('started_at', { ascending: false }).limit(50),
    client.from('discovered_drinks').select('*, coffee_sources(name)').order('discovered_at', { ascending: false }).limit(200),
    client
      .from('recipe_drafts')
      .select(
        '*, recipe_draft_ingredients(id), recipe_draft_steps(id, instruction), recipe_draft_equipment(equipment_id), recipe_draft_collections(collection_id, recipe_collections(title))',
      )
      .order('updated_at', { ascending: false })
      .limit(200),
    client.from('ingredients').select('id,name,canonical_name,category,aliases,default_unit,active').order('name'),
    client.from('recipe_collections').select('id,title,description,sort_order,active').order('sort_order'),
  ]);
  const error = sources.error ?? runs.error ?? drinks.error ?? drafts.error ?? ingredients.error ?? collections.error;
  if (error) throw error;

  return {
    sources: (sources.data ?? []) as AdminSource[],
    runs: (runs.data ?? []) as unknown as AdminImportRun[],
    drinks: (drinks.data ?? []) as unknown as AdminDiscoveredDrink[],
    drafts: (drafts.data ?? []) as AdminRecipeDraft[],
    ingredients: ingredients.data ?? [],
    collections: collections.data ?? [],
  };
}

export async function runAdminAction(action: AdminAction) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('coffee-discovery', { body: action });
  if (error) {
    const context = 'context' in error ? (error as { context?: Response }).context : undefined;
    if (context) {
      try {
        const payload = await context.clone().json() as { error?: string };
        if (payload.error) throw new Error(payload.error);
      } catch (contextError) {
        if (contextError instanceof Error && contextError.message !== 'Unexpected end of JSON input') throw contextError;
      }
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data?.data;
}

// --- Bulk actions -----------------------------------------------------------------------------
// These operate directly on tables the admin RLS policies already grant `authenticated` admins
// full access to (see "Admins manage recipe drafts" / "Admins manage draft collections" in the
// migrations) rather than round-tripping through the coffee-discovery Edge Function. Publishing
// itself always stays a single-recipe action routed through `publish-authoring-draft` — there is
// intentionally no bulk-publish helper here.

export async function bulkAssignCollection(draftIds: string[], collectionId: string) {
  const client = requireSupabase();
  const rows = draftIds.map((draftId) => ({ draft_id: draftId, collection_id: collectionId }));
  const { error } = await client.from('recipe_draft_collections').upsert(rows, { onConflict: 'draft_id,collection_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function bulkAssignSource(draftIds: string[], sourceName: string, sourceUrl: string | null) {
  const client = requireSupabase();
  const { error } = await client
    .from('recipe_drafts')
    .update({ source_name: sourceName, source_url: sourceUrl })
    .in('id', draftIds);
  if (error) throw error;
}

export async function bulkSetNeedsTesting(draftIds: string[], needsTesting: boolean) {
  const client = requireSupabase();
  const { error } = await client.from('recipe_drafts').update({ needs_testing: needsTesting }).in('id', draftIds);
  if (error) throw error;
}

export async function bulkMarkAttributionComplete(draftIds: string[]) {
  const client = requireSupabase();
  const { error } = await client.from('recipe_drafts').update({ attribution_status: 'complete' }).in('id', draftIds);
  if (error) throw error;
}

export async function markDraftsReviewed(draftIds: string[], adminUserId: string) {
  const client = requireSupabase();
  const { error } = await client
    .from('recipe_drafts')
    .update({ last_reviewed_at: new Date().toISOString(), last_reviewed_by: adminUserId })
    .in('id', draftIds);
  if (error) throw error;
}

/** Archives each selected draft one at a time through the existing lifecycle RPC, so audit
 * logging and the "unpublish if it was published" safety check still run per draft. */
export async function bulkArchiveDrafts(draftIds: string[]) {
  for (const draftId of draftIds) {
    // eslint-disable-next-line no-await-in-loop -- intentionally sequential: each call is a
    // separate audited lifecycle transition, not a batch we want to fire concurrently.
    await runAdminAction({ action: 'transition-authoring-draft', draftId, status: 'archived' });
  }
}

// --- Export -------------------------------------------------------------------------------------

export type ExportDraftRow = AdminRecipeDraft & {
  ingredients: Array<{ ingredient_id: string; display_name: string | null; quantity: number; unit: string; position: number }>;
  steps: Array<{ position: number; instruction: string; timer_seconds: number | null }>;
  equipment: Array<{ equipment_id: string; position: number; optional: boolean }>;
  tags: string[];
  collections: string[];
};

export async function exportDraftsForBackup(draftIds: string[]): Promise<ExportDraftRow[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('recipe_drafts')
    .select(
      `*,
      recipe_draft_ingredients(ingredient_id, display_name, quantity, unit, position),
      recipe_draft_steps(position, instruction, timer_seconds),
      recipe_draft_equipment(equipment_id, position, optional),
      recipe_draft_tags(tag_id),
      recipe_draft_collections(collection_id)`,
    )
    .in('id', draftIds);
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    ingredients: row.recipe_draft_ingredients ?? [],
    steps: row.recipe_draft_steps ?? [],
    equipment: row.recipe_draft_equipment ?? [],
    tags: (row.recipe_draft_tags ?? []).map((t: { tag_id: string }) => t.tag_id),
    collections: (row.recipe_draft_collections ?? []).map((c: { collection_id: string }) => c.collection_id),
  }));
}

export function draftsToJson(rows: ExportDraftRow[]): string {
  return JSON.stringify(rows, null, 2);
}

export function draftsToCsv(rows: ExportDraftRow[]): string {
  const columns = [
    'id', 'proposed_title', 'slug', 'status', 'category', 'temperature', 'inspiration_label',
    'source_name', 'source_url', 'needs_testing', 'tested', 'image_status', 'attribution_status',
    'validation_status', 'ingredient_count', 'step_count', 'equipment_count', 'collections',
  ];
  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.id, row.proposed_title, row.slug ?? '', row.status, row.category, row.temperature,
        row.inspiration_label, row.source_name, row.source_url, row.needs_testing, row.tested,
        row.image_status, row.attribution_status, row.validation_status,
        row.ingredients.length, row.steps.length, row.equipment.length, row.collections.join('; '),
      ]
        .map(escape)
        .join(','),
    );
  }
  return lines.join('\n');
}

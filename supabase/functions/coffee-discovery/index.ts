import { createClient } from 'npm:@supabase/supabase-js@2.57.0';
import {
  createRecipeDraft,
  fetchMenuPage,
  isAdminUser,
  parseMenu,
  processParsedDrinks,
  type CoffeeSource,
  type DiscoveredDrinkRecord,
  type DraftStatus,
  type DrinkStatus,
} from '../_shared/coffee-discovery.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ActionBody =
  | { action: 'import-source'; sourceId: string }
  | { action: 'convert-drink'; drinkId: string }
  | { action: 'update-source-enabled'; sourceId: string; enabled: boolean }
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
  | { action: 'save-authoring-draft'; draft: Record<string, unknown>; expectedVersion: number }
  | { action: 'transition-authoring-draft'; draftId: string; status: 'draft' | 'tested' | 'ready' | 'archived' }
  | { action: 'publish-authoring-draft'; draftId: string }
  | { action: 'unpublish-authoring-draft'; draftId: string }
  | { action: 'duplicate-authoring-draft'; draftId: string }
  | { action: 'save-ingredient'; ingredient: { id: string; name: string; canonicalName: string; category: string; aliases: string[]; defaultUnit: string | null; active: boolean } }
  | { action: 'save-collection'; collection: { id: string; title: string; description: string; sortOrder: number; active: boolean } };

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing Edge Function environment variable: ${name}`);
  return value;
}

function readFirstNamedKey(name: 'SUPABASE_PUBLISHABLE_KEYS' | 'SUPABASE_SECRET_KEYS') {
  const raw = Deno.env.get(name);
  if (!raw) return null;
  try {
    const keys = JSON.parse(raw) as Record<string, string>;
    return Object.values(keys)[0] ?? null;
  } catch {
    return null;
  }
}

function getClients(authorization: string) {
  const url = requiredEnvironment('SUPABASE_URL');
  const publishableKey =
    Deno.env.get('SUPABASE_ANON_KEY') ??
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
    readFirstNamedKey('SUPABASE_PUBLISHABLE_KEYS');
  const secretKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SECRET_KEY') ??
    readFirstNamedKey('SUPABASE_SECRET_KEYS');
  if (!publishableKey || !secretKey) throw new Error('Supabase function keys are unavailable.');

  return {
    userClient: createClient(url, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    adminClient: createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

function cleanError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
      ? error.message
      : 'Unknown import failure.';
  return message.replace(/[\r\n]+/g, ' ').slice(0, 500);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function runImport(adminClient: ReturnType<typeof createClient>, sourceId: string) {
  const { data: sourceData, error: sourceError } = await adminClient
    .from('coffee_sources')
    .select('*')
    .eq('id', sourceId)
    .single();
  if (sourceError || !sourceData) throw new Error('Configured coffee source was not found.');
  const source = sourceData as CoffeeSource & {
    cooldown_minutes: number;
    last_imported_at: string | null;
  };

  if (!source.enabled) {
    const { data: skipped, error } = await adminClient
      .from('menu_import_runs')
      .insert({
        source_id: source.id,
        status: 'skipped',
        completed_at: new Date().toISOString(),
        error_message: 'Source is disabled until its parser and URL are verified.',
      })
      .select()
      .single();
    if (error) throw error;
    return skipped;
  }

  const lastImported = source.last_imported_at ? Date.parse(source.last_imported_at) : 0;
  if (lastImported && Date.now() - lastImported < source.cooldown_minutes * 60_000) {
    const { data: skipped, error } = await adminClient
      .from('menu_import_runs')
      .insert({
        source_id: source.id,
        status: 'skipped',
        completed_at: new Date().toISOString(),
        error_message: `Cooldown active for ${source.cooldown_minutes} minutes.`,
      })
      .select()
      .single();
    if (error) throw error;
    return skipped;
  }

  const { data: run, error: runError } = await adminClient
    .from('menu_import_runs')
    .insert({ source_id: source.id, status: 'running' })
    .select()
    .single();
  if (runError || !run) throw runError ?? new Error('Import run could not be created.');

  try {
    const html = await fetchMenuPage(source);
    const parsed = parseMenu(html, source);
    if (!parsed.length) throw new Error('The configured parser found no menu drinks.');

    const { data: existingData, error: existingError } = await adminClient
      .from('discovered_drinks')
      .select('*')
      .eq('source_id', source.id);
    if (existingError) throw existingError;

    const processed = processParsedDrinks(
      source,
      parsed,
      (existingData ?? []) as DiscoveredDrinkRecord[],
    );

    for (const item of processed.items) {
      if (!item.record || item.action === 'duplicate' || item.action === 'failed') continue;
      const { error } = await adminClient
        .from('discovered_drinks')
        .upsert(item.record, { onConflict: 'fingerprint' });
      if (error) {
        processed.counts.failed += 1;
        processed.counts[item.action] -= 1;
      }
    }

    const completedAt = new Date().toISOString();
    const status = processed.counts.failed > 0 ? 'partial' : 'succeeded';
    const { data: completedRun, error: completeError } = await adminClient
      .from('menu_import_runs')
      .update({
        status,
        completed_at: completedAt,
        discovered_count: processed.counts.discovered,
        new_count: processed.counts.new,
        duplicate_count: processed.counts.duplicate,
        updated_count: processed.counts.updated,
        failed_count: processed.counts.failed,
      })
      .eq('id', run.id)
      .select()
      .single();
    if (completeError) throw completeError;

    await adminClient
      .from('coffee_sources')
      .update({ last_imported_at: completedAt })
      .eq('id', source.id);
    return completedRun;
  } catch (error) {
    const message = cleanError(error);
    await adminClient
      .from('menu_import_runs')
      .update({ status: 'failed', completed_at: new Date().toISOString(), error_message: message })
      .eq('id', run.id);
    throw new Error(message);
  }
}

async function convertDrink(
  adminClient: ReturnType<typeof createClient>,
  drinkId: string,
  adminUserId: string,
) {
  const { data: drinkData, error: drinkError } = await adminClient
    .from('discovered_drinks')
    .select('*, coffee_sources(*)')
    .eq('id', drinkId)
    .single();
  if (drinkError || !drinkData) throw new Error('Discovered drink was not found.');

  const drink = drinkData as DiscoveredDrinkRecord & { coffee_sources: CoffeeSource };
  if (drink.status !== 'reviewed' && drink.status !== 'converted') {
    throw new Error('Review the drink before converting it to a draft.');
  }

  const { data: existingDraft } = await adminClient
    .from('recipe_drafts')
    .select('*')
    .eq('discovered_drink_id', drink.id)
    .maybeSingle();
  if (existingDraft) {
    if (drink.status !== 'converted') {
      await adminClient.from('discovered_drinks').update({ status: 'converted' }).eq('id', drink.id);
    }
    return existingDraft;
  }

  const payload = createRecipeDraft(drink, drink.coffee_sources, adminUserId);
  const { data: draft, error: draftError } = await adminClient
    .from('recipe_drafts')
    .insert(payload)
    .select()
    .single();
  if (draftError || !draft) throw draftError ?? new Error('Recipe draft could not be created.');

  const { error: statusError } = await adminClient
    .from('discovered_drinks')
    .update({ status: 'converted' satisfies DrinkStatus })
    .eq('id', drink.id);
  if (statusError) throw statusError;
  return draft;
}

async function handleAction(
  adminClient: ReturnType<typeof createClient>,
  adminUserId: string,
  body: ActionBody,
) {
  if (body.action === 'save-ingredient') {
    const item = body.ingredient;
    const categories = ['coffee', 'espresso', 'milk', 'syrup', 'sauce', 'sweetener', 'spice', 'topping', 'pantry', 'tea', 'matcha', 'other'];
    const units = ['shot', 'oz', 'fl oz', 'cup', 'tbsp', 'tsp', 'mL', 'g', 'pinch', 'pump', 'piece', 'to taste'];
    if (!item?.id?.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) || !item.name?.trim() || !item.canonicalName?.trim() || !categories.includes(item.category) || (item.defaultUnit && !units.includes(item.defaultUnit))) throw new Error('Invalid ingredient catalog entry.');
    const { data, error } = await adminClient.from('ingredients').upsert({
      id: item.id, name: item.name.trim().slice(0, 120), canonical_name: item.canonicalName.trim().toLowerCase().slice(0, 120),
      category: item.category, aliases: item.aliases.map((value) => value.trim().toLowerCase()).filter(Boolean),
      default_unit: item.defaultUnit, active: item.active,
    }).select().single();
    if (error) throw error;
    return data;
  }
  if (body.action === 'save-collection') {
    const item = body.collection;
    if (!item?.id?.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) || !item.title?.trim() || !Number.isInteger(item.sortOrder)) throw new Error('Invalid recipe collection.');
    const { data, error } = await adminClient.from('recipe_collections').upsert({
      id: item.id, title: item.title.trim().slice(0, 120), description: item.description.trim().slice(0, 500),
      sort_order: item.sortOrder, active: item.active,
    }).select().single();
    if (error) throw error;
    return data;
  }
  if (body.action === 'save-authoring-draft') {
    if (!isUuid(String(body.draft?.id)) || !Number.isInteger(body.expectedVersion)) throw new Error('Invalid authoring draft save.');
    const { data, error } = await adminClient.rpc('save_recipe_draft', {
      p_draft_id: body.draft.id,
      p_expected_version: body.expectedVersion,
      p_payload: body.draft,
      p_admin_user_id: adminUserId,
    });
    if (error) throw error;
    return data;
  }
  if (body.action === 'transition-authoring-draft') {
    if (!isUuid(body.draftId) || !['draft', 'tested', 'ready', 'archived'].includes(body.status)) throw new Error('Invalid authoring draft transition.');
    const { data, error } = await adminClient.rpc('transition_recipe_draft', {
      p_draft_id: body.draftId, p_status: body.status, p_admin_user_id: adminUserId,
    });
    if (error) throw error;
    return data;
  }
  if (body.action === 'publish-authoring-draft') {
    if (!isUuid(body.draftId)) throw new Error('A valid draft ID is required.');
    const { data, error } = await adminClient.rpc('publish_recipe_draft', { p_draft_id: body.draftId, p_admin_user_id: adminUserId });
    if (error) throw error;
    return data;
  }
  if (body.action === 'unpublish-authoring-draft') {
    if (!isUuid(body.draftId)) throw new Error('A valid draft ID is required.');
    const { data, error } = await adminClient.rpc('unpublish_recipe_draft', { p_draft_id: body.draftId, p_admin_user_id: adminUserId });
    if (error) throw error;
    return data;
  }
  if (body.action === 'duplicate-authoring-draft') {
    if (!isUuid(body.draftId)) throw new Error('A valid draft ID is required.');
    const { data, error } = await adminClient.rpc('duplicate_recipe_draft', { p_draft_id: body.draftId, p_admin_user_id: adminUserId });
    if (error) throw error;
    return { id: data };
  }
  if (body.action === 'import-source') {
    if (!isUuid(body.sourceId)) throw new Error('A valid source ID is required.');
    return runImport(adminClient, body.sourceId);
  }
  if (body.action === 'convert-drink') {
    if (!isUuid(body.drinkId)) throw new Error('A valid drink ID is required.');
    return convertDrink(adminClient, body.drinkId, adminUserId);
  }
  if (body.action === 'update-source-enabled') {
    if (!isUuid(body.sourceId) || typeof body.enabled !== 'boolean') {
      throw new Error('Invalid source update.');
    }
    const { data, error } = await adminClient
      .from('coffee_sources')
      .update({ enabled: body.enabled })
      .eq('id', body.sourceId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  if (body.action === 'update-drink-status') {
    if (!isUuid(body.drinkId) || !['reviewed', 'ignored'].includes(body.status)) {
      throw new Error('Invalid drink status update.');
    }
    const { data, error } = await adminClient
      .from('discovered_drinks')
      .update({ status: body.status })
      .eq('id', body.drinkId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  if (body.action === 'update-draft-status') {
    if (!isUuid(body.draftId) || !['draft', 'tested', 'ready', 'archived'].includes(body.status)) {
      throw new Error('Invalid draft status update.');
    }
    const updates: { status: DraftStatus; needs_testing?: boolean } = { status: body.status };
    if (body.status === 'tested') updates.needs_testing = false;
    if (body.status === 'draft') updates.needs_testing = true;
    const { data, error } = await adminClient
      .from('recipe_drafts')
      .update(updates)
      .eq('id', body.draftId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  if (body.action === 'save-draft') {
    if (!isUuid(body.draftId) || !body.proposedTitle.trim()) throw new Error('A draft title is required.');
    const lists = [body.suggestedIngredients, body.suggestedEquipment, body.suggestedSteps];
    if (!lists.every((list) => Array.isArray(list) && list.every((item) => typeof item === 'string'))) {
      throw new Error('Draft suggestions must be string lists.');
    }
    const { data, error } = await adminClient
      .from('recipe_drafts')
      .update({
        proposed_title: body.proposedTitle.trim().slice(0, 180),
        description: body.description.trim().slice(0, 500),
        suggested_ingredients: body.suggestedIngredients.map((item) => item.trim()).filter(Boolean),
        suggested_equipment: body.suggestedEquipment.map((item) => item.trim()).filter(Boolean),
        suggested_steps: body.suggestedSteps.map((item) => item.trim()).filter(Boolean),
      })
      .eq('id', body.draftId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  throw new Error('Unsupported admin action.');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required.' }, 401);
    const token = authorization.slice('Bearer '.length);
    const { userClient, adminClient } = getClients(authorization);
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data.user) return json({ error: 'Authentication required.' }, 401);
    if (!isAdminUser(data.user)) return json({ error: 'Admin access required.' }, 403);

    const body = await request.json() as ActionBody;
    const result = await handleAction(adminClient, data.user.id, body);
    return json({ data: result });
  } catch (error) {
    console.error('[coffee-discovery]', cleanError(error));
    return json({ error: cleanError(error) }, 400);
  }
});

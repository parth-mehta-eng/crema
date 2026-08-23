import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.CREMA_ADMIN_EMAIL;
const password = process.env.CREMA_ADMIN_PASSWORD;
if (!url || !key || !email || !password) throw new Error('Set local Supabase and CREMA_ADMIN_* environment variables.');

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function action(body) {
  const { data, error } = await client.functions.invoke('coffee-discovery', { body });
  if (error) {
    try {
      const payload = await error.context?.clone().json();
      throw new Error(payload?.error ?? error.message);
    } catch (nested) {
      throw nested instanceof Error ? nested : error;
    }
  }
  if (data?.error) throw new Error(data.error);
  return data?.data;
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

const { data: auth, error: authError } = await client.auth.signInWithPassword({ email, password });
if (authError) throw authError;
assert(auth.user?.app_metadata?.role === 'admin', 'Acceptance account is not an admin.');

const { data: discovery, error: discoveryError } = await client.from('discovered_drinks').select('*').eq('normalized_name', 'brown sugar shaken espresso').single();
if (discoveryError) throw discoveryError;
console.log('1/10 Opened discovered Brown Sugar drink.');

const draft = await action({ action: 'convert-drink', drinkId: discovery.id });
assert(draft?.id, 'Conversion did not return a draft.');
console.log('2/10 Converted discovery to draft.');

const imageBytes = await readFile(new URL('../assets/admin/brown-sugar-shaken-espresso-test.png', import.meta.url));
const imagePath = `${draft.id}/acceptance-brown-sugar.png`;
const { error: uploadError } = await client.storage.from('recipe-images').upload(imagePath, imageBytes, { contentType: 'image/png', upsert: true });
if (uploadError) throw uploadError;
const imageUrl = client.storage.from('recipe-images').getPublicUrl(imagePath).data.publicUrl;
console.log('3/10 Uploaded owned 4:5 hero image through admin-only Storage policy.');

const baseDraft = {
  id: draft.id, proposedTitle: 'Brown Sugar Shaken Espresso — Weekend 5', slug: 'brown-sugar-shaken-espresso-weekend-5',
  description: 'A bold iced espresso shaken with brown sugar and cinnamon, finished with oat milk.',
  inspirationLabel: 'Starbucks inspired', sourceName: 'Starbucks', sourceUrl: 'https://www.starbucks.com/menu',
  collectionIds: ['coffee-shop-inspired', 'iced-favorites', 'five-minute-coffees'], status: 'draft', featured: false,
  tested: false, category: 'espresso', temperature: 'iced', difficulty: 'Easy', prepMinutes: 5, totalMinutes: 5,
  servings: 1, cupSize: '16 oz', sweetness: 3, strength: 4, caffeineMg: 150, calories: 120,
  heroImageUrl: imageUrl, heroImagePath: imagePath, heroImageAlt: 'Brown sugar shaken espresso with oat milk over ice',
  heroImageMime: 'image/png', heroImageBytes: imageBytes.byteLength, placeholderApproved: false, needsTesting: true,
  flavorNotes: ['brown sugar', 'cinnamon', 'strong'], ingredients: [], steps: [], equipment: [],
  tagIds: ['brown-sugar', 'cinnamon', 'strong', 'quick'], publishedRecipeId: null,
};
let version = await action({ action: 'save-authoring-draft', draft: baseDraft, expectedVersion: Number(draft.version ?? 1) });
let blocked = false;
try { await action({ action: 'publish-authoring-draft', draftId: draft.id }); }
catch (error) { blocked = /ready|validation|ingredient|step/i.test(error.message); }
assert(blocked, 'Incomplete draft was not blocked from publishing.');
const { data: absentBefore } = await anon.from('recipes').select('id').eq('slug', baseDraft.slug);
assert(absentBefore?.length === 0, 'Incomplete publish created a public recipe.');
console.log('4/10 Incomplete publish was blocked with no partial public row.');

const espressoRow = '41111111-1111-4111-8111-111111111111';
const sugarRow = '42222222-2222-4222-8222-222222222222';
const milkRow = '43333333-3333-4333-8333-333333333333';
const completeDraft = {
  ...baseDraft,
  version,
  ingredients: [
    { id: espressoRow, ingredientId: 'espresso', displayName: '', quantity: 2, unit: 'shot', preparationNote: 'freshly brewed', optional: false, substitutionNotes: 'Use concentrated coffee if needed.', position: 1 },
    { id: sugarRow, ingredientId: 'brown-sugar', displayName: 'Brown sugar syrup', quantity: 1, unit: 'tbsp', preparationNote: 'cooled', optional: false, substitutionNotes: 'Maple syrup gives a different but balanced finish.', position: 2 },
    { id: milkRow, ingredientId: 'oat-milk', displayName: '', quantity: 3, unit: 'fl oz', preparationNote: 'cold', optional: false, substitutionNotes: 'Any milk works.', position: 3 },
  ],
  steps: [
    { id: '51111111-1111-4111-8111-111111111111', instruction: 'Add espresso, brown sugar syrup, cinnamon, and ice to a shaker.', timerSeconds: null, tip: 'Use a heat-safe shaker.', ingredientRowIds: [espressoRow, sugarRow], position: 1 },
    { id: '52222222-2222-4222-8222-222222222222', instruction: 'Shake vigorously until chilled and lightly foamy.', timerSeconds: 15, tip: '', ingredientRowIds: [espressoRow, sugarRow], position: 2 },
    { id: '53333333-3333-4333-8333-333333333333', instruction: 'Pour over fresh ice and finish with oat milk.', timerSeconds: null, tip: 'Pour slowly to keep the layers visible.', ingredientRowIds: [milkRow], position: 3 },
  ],
  equipment: [
    { equipmentId: 'espresso-machine', optional: false, alternativeNote: 'Nespresso or moka pot can provide concentrated coffee.', position: 1 },
    { equipmentId: 'cocktail-shaker', optional: false, alternativeNote: 'Use a tightly sealed jar.', position: 2 },
  ],
};
version = await action({ action: 'save-authoring-draft', draft: completeDraft, expectedVersion: version });
console.log('5/10 Added structured ingredients, steps, timers, references, and equipment.');

await action({ action: 'transition-authoring-draft', draftId: draft.id, status: 'tested' });
console.log('6/10 Marked recipe physically tested.');
await action({ action: 'transition-authoring-draft', draftId: draft.id, status: 'ready' });
console.log('7/10 Valid recipe moved to ready.');
const recipeId = await action({ action: 'publish-authoring-draft', draftId: draft.id });
console.log('8/10 Published through the server-side transaction.');

const { data: publicRecipe, error: publicError } = await anon.from('recipes').select('id,slug,name,description,published,recipe_ingredients(id),recipe_steps(id),recipe_equipment(equipment_id)').eq('id', recipeId).single();
if (publicError) throw publicError;
assert(publicRecipe.published && publicRecipe.recipe_ingredients.length === 3 && publicRecipe.recipe_steps.length === 3, 'Mobile public query did not return the complete recipe.');
console.log('9/10 Confirmed recipe appears in the anonymous mobile recipe query.');

await action({ action: 'transition-authoring-draft', draftId: draft.id, status: 'draft' });
const edited = { ...completeDraft, version, description: `${completeDraft.description} Finished with a cinnamon aroma.` };
version = await action({ action: 'save-authoring-draft', draft: edited, expectedVersion: version });
await action({ action: 'transition-authoring-draft', draftId: draft.id, status: 'tested' });
await action({ action: 'transition-authoring-draft', draftId: draft.id, status: 'ready' });
const republishedId = await action({ action: 'publish-authoring-draft', draftId: draft.id });
const { data: republished, count, error: republishError } = await anon.from('recipes').select('id,description', { count: 'exact' }).eq('slug', baseDraft.slug);
if (republishError) throw republishError;
assert(republishedId === recipeId && count === 1 && republished?.[0]?.description === edited.description, 'Republish was not an idempotent update.');
console.log('10/10 Edited and republished the same public recipe with no duplicate.');

await client.auth.signOut();
console.log(`ACCEPTANCE PASS — recipe ID ${recipeId}, final draft version ${version}.`);

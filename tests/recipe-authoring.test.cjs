const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScriptModule } = require('./load-typescript.cjs');

const {
  duplicateDraft,
  normalizePositions,
  publicationRecipeId,
  validateDraft,
  validateTransition,
} = loadTypeScriptModule('services/authoring/domain.ts');

function completeDraft(overrides = {}) {
  return {
    id: 'draft-1',
    proposedTitle: 'Brown Sugar Shaken Espresso',
    slug: 'brown-sugar-shaken-espresso-weekend-5',
    description: 'A bright shaken espresso with brown sugar and oat milk.',
    inspirationLabel: 'Inspired by Starbucks',
    sourceName: 'Starbucks',
    sourceUrl: 'https://www.starbucks.com/menu',
    collectionIds: ['coffee-shop-inspired'],
    status: 'ready',
    featured: false,
    tested: true,
    category: 'espresso',
    temperature: 'iced',
    difficulty: 'Easy',
    prepMinutes: 5,
    totalMinutes: 5,
    servings: 1,
    cupSize: '16 oz',
    sweetness: 2,
    strength: 3,
    caffeineMg: null,
    calories: null,
    heroImageUrl: 'https://example.test/recipe.webp',
    heroImageAlt: 'Brown sugar shaken espresso over ice',
    placeholderApproved: false,
    needsTesting: false,
    flavorNotes: ['brown sugar', 'strong'],
    ingredients: [
      { id: 'row-1', ingredientId: 'espresso', displayName: '', quantity: 2, unit: 'shot', preparationNote: '', optional: false, substitutionNotes: '', position: 1 },
      { id: 'row-2', ingredientId: 'oat-milk', displayName: '', quantity: 3, unit: 'fl oz', preparationNote: '', optional: false, substitutionNotes: '', position: 2 },
    ],
    steps: [{ id: 'step-1', instruction: 'Shake espresso with syrup and ice.', timerSeconds: 15, tip: '', ingredientRowIds: ['row-1'], position: 1 }],
    equipment: [{ equipmentId: 'cocktail-shaker', optional: false, alternativeNote: '', position: 1 }],
    tagIds: ['brown-sugar'],
    publishedRecipeId: null,
    ...overrides,
  };
}

test('complete ready draft passes centralized validation', () => {
  assert.deepEqual(validateDraft(completeDraft(), []), []);
});

test('incomplete draft returns field-level publishing errors', () => {
  const result = validateDraft(completeDraft({
    proposedTitle: '', slug: '', description: '', category: '', temperature: '', difficulty: '',
    prepMinutes: 0, servings: 0, heroImageUrl: '', ingredients: [], steps: [], equipment: [], tested: false,
    needsTesting: true,
  }), []);
  const fields = new Set(result.map((error) => error.field));
  for (const field of ['proposedTitle', 'slug', 'description', 'category', 'temperature', 'difficulty', 'prepMinutes', 'servings', 'ingredients', 'steps', 'equipment', 'heroImageUrl', 'tested']) {
    assert.ok(fields.has(field), `expected ${field}`);
  }
});

test('cafe-inspired recipes require attribution and unique slugs', () => {
  const draft = completeDraft({ sourceName: '', sourceUrl: '' });
  const errors = validateDraft(draft, [{ slug: draft.slug, recipeId: 'different-recipe' }]);
  assert.ok(errors.some((error) => error.field === 'sourceName'));
  assert.ok(errors.some((error) => error.field === 'sourceUrl'));
  assert.ok(errors.some((error) => error.field === 'slug'));
  assert.equal(validateDraft(completeDraft({ publishedRecipeId: 'same-recipe' }), [{ slug: draft.slug, recipeId: 'same-recipe' }]).length, 0);
});

test('ingredient validation permits meaningful preparation variants only', () => {
  const duplicate = { ...completeDraft().ingredients[0], id: 'row-3', position: 3 };
  assert.ok(validateDraft(completeDraft({ ingredients: [...completeDraft().ingredients, duplicate] }), []).some((error) => error.code === 'duplicate_ingredient'));

  const prepared = { ...duplicate, preparationNote: 'decaf' };
  assert.equal(validateDraft(completeDraft({ ingredients: [...completeDraft().ingredients, prepared] }), []).filter((error) => error.code === 'duplicate_ingredient').length, 0);
  assert.ok(validateDraft(completeDraft({ ingredients: [{ ...duplicate, quantity: 0, unit: '' }] }), []).some((error) => error.field === 'ingredients.0.quantity'));
});

test('positions normalize after reorder without mutating input', () => {
  const rows = [{ id: 'b', position: 8 }, { id: 'a', position: 2 }];
  const normalized = normalizePositions(rows);
  assert.deepEqual(normalized.map((row) => row.position), [1, 2]);
  assert.equal(rows[0].position, 8);
});

test('lifecycle accepts only explicit transitions', () => {
  assert.equal(validateTransition('draft', 'tested'), null);
  assert.equal(validateTransition('tested', 'ready'), null);
  assert.equal(validateTransition('ready', 'published'), null);
  assert.equal(validateTransition('published', 'draft'), null);
  assert.match(validateTransition('draft', 'published'), /cannot move/i);
  assert.match(validateTransition('archived', 'published'), /cannot move/i);
});

test('duplicating resets identity, publication, status, and testing', () => {
  const result = duplicateDraft(completeDraft({ publishedRecipeId: 'recipe-1' }), 'draft-2');
  assert.equal(result.id, 'draft-2');
  assert.equal(result.publishedRecipeId, null);
  assert.equal(result.status, 'draft');
  assert.equal(result.tested, false);
  assert.equal(result.needsTesting, true);
  assert.match(result.slug, /-copy$/);
  assert.notEqual(result.ingredients[0].id, 'row-1');
  assert.notEqual(result.steps[0].id, 'step-1');
});

test('publication identity is stable for idempotent republish', () => {
  assert.equal(publicationRecipeId(completeDraft({ publishedRecipeId: 'recipe-1' })), 'recipe-1');
  assert.equal(publicationRecipeId(completeDraft({ publishedRecipeId: null })), 'draft-1');
});

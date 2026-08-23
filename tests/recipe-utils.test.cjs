const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScriptModule } = require('./load-typescript.cjs');

const {
  formatScaledQuantity,
  getRecipeMatch,
  getCoffeeBarSummary,
} = loadTypeScriptModule('lib/recipe-utils.ts');

test('formatScaledQuantity renders scaled fractions without floating-point artifacts', () => {
  assert.equal(formatScaledQuantity(0.75, 2), '1½');
  assert.equal(formatScaledQuantity(1.5, 3), '4½');
  assert.equal(formatScaledQuantity(2, 1), '2');
});

test('getRecipeMatch ignores optional ingredients and tracks equipment separately', () => {
  const recipe = {
    id: 'test',
    ingredients: [
      { id: 'espresso', name: 'Espresso', quantity: 2, unit: 'shots' },
      { id: 'milk', name: 'Milk', quantity: 0.75, unit: 'cup' },
      { id: 'foam', name: 'Foam', quantity: 0.25, unit: 'cup', optional: true },
    ],
    equipment: ['espresso-machine', 'frother'],
  };

  const match = getRecipeMatch(recipe, ['espresso'], ['espresso-machine']);

  assert.deepEqual(match.requiredIngredients.map((item) => item.id), ['espresso', 'milk']);
  assert.deepEqual(match.ownedIngredients.map((item) => item.id), ['espresso']);
  assert.deepEqual(match.missingIngredients.map((item) => item.id), ['milk']);
  assert.deepEqual(match.ownedEquipment, ['espresso-machine']);
  assert.deepEqual(match.missingEquipment, ['frother']);
  // Missing equipment is reported distinctly from missing ingredients, even though an
  // ingredient is also missing here.
  assert.equal(match.classification, 'Equipment Missing');
});

test('getRecipeMatch classifies by missing-ingredient count when equipment is fully owned', () => {
  const base = { id: 'test', equipment: ['espresso-machine'] };
  const owned = ['espresso-machine'];

  assert.equal(
    getRecipeMatch({ ...base, ingredients: [{ id: 'espresso', name: 'Espresso', quantity: 1, unit: 'shot' }] }, ['espresso'], owned)
      .classification,
    'Perfect Match',
  );
  assert.equal(
    getRecipeMatch(
      { ...base, ingredients: [{ id: 'espresso', name: 'Espresso', quantity: 1, unit: 'shot' }, { id: 'milk', name: 'Milk', quantity: 1, unit: 'cup' }] },
      [],
      owned,
    ).classification,
    'Missing 2',
  );
  assert.equal(
    getRecipeMatch(
      {
        ...base,
        ingredients: [
          { id: 'espresso', name: 'Espresso', quantity: 1, unit: 'shot' },
          { id: 'milk', name: 'Milk', quantity: 1, unit: 'cup' },
          { id: 'ice', name: 'Ice', quantity: 1, unit: 'cup' },
        ],
      },
      [],
      owned,
    ).classification,
    'Missing 3+',
  );
});

test('getCoffeeBarSummary counts makeable recipes and true one-ingredient-away recipes', () => {
  const recipes = [
    {
      id: 'ready',
      ingredients: [{ id: 'espresso', name: 'Espresso', quantity: 2, unit: 'shots' }],
      equipment: ['espresso-machine'],
    },
    {
      id: 'one-away',
      ingredients: [
        { id: 'espresso', name: 'Espresso', quantity: 2, unit: 'shots' },
        { id: 'ice', name: 'Ice', quantity: 1, unit: 'cup' },
      ],
      equipment: ['espresso-machine'],
    },
    {
      id: 'equipment-away',
      ingredients: [{ id: 'espresso', name: 'Espresso', quantity: 2, unit: 'shots' }],
      equipment: ['espresso-machine', 'shaker'],
    },
  ];

  const summary = getCoffeeBarSummary(recipes, ['espresso'], ['espresso-machine']);

  assert.deepEqual(summary.makeableRecipeIds, ['ready']);
  assert.deepEqual(summary.oneIngredientAwayRecipeIds, ['one-away']);
});

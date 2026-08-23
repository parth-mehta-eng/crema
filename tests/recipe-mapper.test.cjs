const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScriptModule } = require('./load-typescript.cjs');

const { mapRecipeRow } = loadTypeScriptModule('services/recipes/mapper.ts');

test('maps and orders normalized Supabase recipe relations', () => {
  const recipe = mapRecipeRow({
    id: '2',
    slug: 'brown-sugar-shaken-espresso',
    name: 'Brown Sugar Shaken Espresso',
    subtitle: 'Bold, spiced, and silky',
    inspiration: 'Starbucks Inspired',
    description: 'Bold espresso shaken with brown sugar.',
    image_url: 'https://example.com/coffee.jpg',
    minutes: 5,
    difficulty: 'Easy',
    temperature: 'Iced',
    servings: 1,
    cup_size: '16 oz',
    tags: ['Iced', 'Quick'],
    recipe_ingredients: [
      {
        position: 2,
        quantity: '1.5',
        unit: 'tbsp',
        note: null,
        optional: false,
        ingredients: { id: 'brown-sugar', name: 'Brown sugar' },
      },
      {
        position: 1,
        quantity: 2,
        unit: 'shot',
        note: null,
        optional: false,
        ingredients: { id: 'espresso', name: 'Espresso' },
      },
    ],
    recipe_steps: [
      { position: 2, instruction: 'Shake with ice.', timer_seconds: 15 },
      { position: 1, instruction: 'Pull two shots.', timer_seconds: null },
    ],
    recipe_equipment: [
      { position: 2, equipment: { id: 'shaker', name: 'Shaker' } },
      { position: 1, equipment: { id: 'espresso-machine', name: 'Espresso machine' } },
    ],
  });

  assert.equal(recipe.image, 'https://example.com/coffee.jpg');
  assert.equal(recipe.cupSize, '16 oz');
  assert.deepEqual(recipe.ingredients.map((ingredient) => ingredient.id), ['espresso', 'brown-sugar']);
  assert.equal(recipe.ingredients[1].quantity, 1.5);
  assert.deepEqual(recipe.equipment, ['espresso-machine', 'shaker']);
  assert.deepEqual(recipe.steps, [
    { instruction: 'Pull two shots.' },
    { instruction: 'Shake with ice.', timerSeconds: 15 },
  ]);
});

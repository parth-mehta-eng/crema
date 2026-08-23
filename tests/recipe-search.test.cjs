const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScriptModule } = require('./load-typescript.cjs');

const { filterRecipes } = loadTypeScriptModule('services/recipes/search.ts');

const recipes = [
  {
    id: '1',
    name: 'Iced Pistachio Latte',
    description: 'A smooth espresso drink with cold milk.',
    inspiration: 'Specialty cafe inspired',
    tags: ['Iced', 'Sweet'],
    temperature: 'Iced',
    category: 'coffee',
    collections: ['Coffee Shop Inspired', 'Iced Favorites'],
    minutes: 10,
    prepMinutes: 10,
    difficulty: 'Easy',
    ingredients: [
      { id: 'espresso', name: 'Espresso' },
      { id: 'pistachio', name: 'Pistachio syrup' },
    ],
  },
  {
    id: '2',
    name: 'Honey Cinnamon Oat Latte',
    description: 'A cozy latte with warm spice.',
    inspiration: 'Neighborhood cafe inspired',
    tags: ['Hot', 'Cozy'],
    temperature: 'Hot',
    category: 'coffee',
    collections: ['Crema Originals'],
    minutes: 7,
    prepMinutes: 5,
    difficulty: 'Easy',
    ingredients: [
      { id: 'espresso', name: 'Espresso' },
      { id: 'honey', name: 'Honey' },
    ],
  },
  {
    id: '3',
    name: 'Café au Lait',
    description: 'Equal parts brewed coffee and steamed milk.',
    inspiration: 'Around the World',
    tags: [],
    temperature: 'Hot',
    category: 'around the world',
    collections: ['Around the World'],
    minutes: 12,
    prepMinutes: 8,
    difficulty: 'Medium',
    ingredients: [{ id: 'coffee', name: 'Brewed coffee' }],
  },
];

test('search matches description, inspiration, tags, and ingredient names', () => {
  assert.deepEqual(filterRecipes(recipes, 'smooth', null).map((recipe) => recipe.id), ['1']);
  assert.deepEqual(filterRecipes(recipes, 'neighborhood', null).map((recipe) => recipe.id), ['2']);
  assert.deepEqual(filterRecipes(recipes, 'sweet', null).map((recipe) => recipe.id), ['1']);
  assert.deepEqual(filterRecipes(recipes, 'pistachio', null).map((recipe) => recipe.id), ['1']);
});

test('existing categories filter real recipe fields', () => {
  assert.deepEqual(filterRecipes(recipes, '', 'Iced').map((recipe) => recipe.id), ['1']);
  assert.deepEqual(filterRecipes(recipes, '', 'Hot').map((recipe) => recipe.id), ['2', '3']);
  assert.deepEqual(filterRecipes(recipes, '', 'Espresso').map((recipe) => recipe.id), ['1', '2']);
  assert.deepEqual(filterRecipes(recipes, '', 'Sweet').map((recipe) => recipe.id), ['1']);
});

test('Surprise Me returns one deterministic candidate from the supplied picker', () => {
  assert.deepEqual(filterRecipes(recipes, '', 'Surprise Me', () => 0.99).map((recipe) => recipe.id), ['3']);
});

test('new filters cover category, prep time, difficulty, and collection membership', () => {
  assert.deepEqual(filterRecipes(recipes, '', 'Coffee').map((recipe) => recipe.id), ['1', '2']);
  assert.deepEqual(filterRecipes(recipes, '', 'Quick').map((recipe) => recipe.id), ['2']);
  assert.deepEqual(filterRecipes(recipes, '', 'Easy').map((recipe) => recipe.id), ['1', '2']);
  assert.deepEqual(
    filterRecipes(recipes, '', 'Coffee Shop Inspired').map((recipe) => recipe.id),
    ['1'],
  );
  assert.deepEqual(filterRecipes(recipes, '', 'Around the World').map((recipe) => recipe.id), ['3']);
  assert.deepEqual(filterRecipes(recipes, '', 'Crema Originals').map((recipe) => recipe.id), ['2']);
});

test('inventory-aware filters (Can Make Now, Missing One Ingredient) pass results through unfiltered — the caller applies coffee-bar matching', () => {
  assert.deepEqual(
    filterRecipes(recipes, '', 'Can Make Now').map((recipe) => recipe.id),
    ['1', '2', '3'],
  );
  assert.deepEqual(
    filterRecipes(recipes, 'lait', 'Missing One Ingredient').map((recipe) => recipe.id),
    ['3'],
  );
});

test('search also matches by source/collection and ingredient text', () => {
  assert.deepEqual(filterRecipes(recipes, 'around the world', null).map((recipe) => recipe.id), ['3']);
  assert.deepEqual(filterRecipes(recipes, 'brewed coffee', null).map((recipe) => recipe.id), ['3']);
});

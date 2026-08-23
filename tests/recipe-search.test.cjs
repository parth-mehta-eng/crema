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
    ingredients: [
      { id: 'espresso', name: 'Espresso' },
      { id: 'honey', name: 'Honey' },
    ],
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
  assert.deepEqual(filterRecipes(recipes, '', 'Hot').map((recipe) => recipe.id), ['2']);
  assert.deepEqual(filterRecipes(recipes, '', 'Espresso').map((recipe) => recipe.id), ['1', '2']);
  assert.deepEqual(filterRecipes(recipes, '', 'Sweet').map((recipe) => recipe.id), ['1']);
});

test('Surprise Me returns one deterministic candidate from the supplied picker', () => {
  assert.deepEqual(filterRecipes(recipes, '', 'Surprise Me', () => 0.99).map((recipe) => recipe.id), ['2']);
});

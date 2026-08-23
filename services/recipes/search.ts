export type RecipeFilter =
  | 'Iced'
  | 'Hot'
  | 'Espresso'
  | 'Sweet'
  | 'Coffee'
  | 'Cold Brew'
  | 'Matcha'
  | 'Quick'
  | 'Easy'
  | 'Coffee Shop Inspired'
  | 'Around the World'
  | 'Crema Originals'
  | 'Can Make Now'
  | 'Missing One Ingredient'
  | 'Surprise Me';

/** Filters resolved entirely server-side (or by the local substring fallback) — everything except
 * the two coffee-bar-aware filters, which need inventory context only the caller (the search
 * screen) has. */
const INVENTORY_AWARE_FILTERS: readonly RecipeFilter[] = ['Can Make Now', 'Missing One Ingredient'];

export function isInventoryAwareFilter(filter: RecipeFilter | null): boolean {
  return filter != null && INVENTORY_AWARE_FILTERS.includes(filter);
}

export type SearchableRecipe = {
  id: string;
  name: string;
  description: string;
  inspiration: string;
  tags: string[];
  temperature: string;
  category: string;
  collections: string[];
  minutes: number;
  prepMinutes: number;
  difficulty: string;
  ingredients: Array<{ id: string; name: string }>;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function matchesFilter(
  recipe: SearchableRecipe,
  filter: Exclude<RecipeFilter, 'Surprise Me' | 'Can Make Now' | 'Missing One Ingredient'>,
) {
  switch (filter) {
    case 'Iced':
    case 'Hot':
      return normalize(recipe.temperature) === normalize(filter);
    case 'Espresso':
      return recipe.ingredients.some(
        (ingredient) =>
          normalize(ingredient.id) === 'espresso' || normalize(ingredient.name).includes('espresso'),
      );
    case 'Sweet':
      return recipe.tags.some((tag) => normalize(tag) === 'sweet');
    case 'Coffee':
      return normalize(recipe.category ?? '') === 'coffee';
    case 'Cold Brew':
      return normalize(recipe.category ?? '') === 'cold brew';
    case 'Matcha':
      return normalize(recipe.category ?? '') === 'matcha';
    case 'Quick':
      return (recipe.prepMinutes ?? recipe.minutes) <= 5;
    case 'Easy':
      return normalize(recipe.difficulty ?? '') === 'easy';
    case 'Coffee Shop Inspired':
    case 'Around the World':
    case 'Crema Originals':
      return (recipe.collections ?? []).some((title) => normalize(title) === normalize(filter));
  }
}

export function filterRecipes<T extends SearchableRecipe>(
  recipes: T[],
  query: string,
  filter: RecipeFilter | null,
  picker: () => number = Math.random,
): T[] {
  const normalizedQuery = normalize(query);
  const matchingQuery = normalizedQuery
    ? recipes.filter((recipe) => {
        const searchableText = [
          recipe.name,
          recipe.description,
          recipe.inspiration,
          recipe.category ?? '',
          ...(recipe.collections ?? []),
          ...recipe.tags,
          ...recipe.ingredients.map((ingredient) => ingredient.name),
        ]
          .join(' ')
          .toLocaleLowerCase();

        return searchableText.includes(normalizedQuery);
      })
    : recipes;

  if (!filter) return matchingQuery;

  if (filter === 'Surprise Me') {
    if (!matchingQuery.length) return [];
    const index = Math.min(
      matchingQuery.length - 1,
      Math.max(0, Math.floor(picker() * matchingQuery.length)),
    );
    return [matchingQuery[index]!];
  }

  if (isInventoryAwareFilter(filter)) return matchingQuery;

  return matchingQuery.filter((recipe) =>
    matchesFilter(recipe, filter as Exclude<RecipeFilter, 'Surprise Me' | 'Can Make Now' | 'Missing One Ingredient'>),
  );
}

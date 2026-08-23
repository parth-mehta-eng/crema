export type RecipeFilter = 'Iced' | 'Hot' | 'Espresso' | 'Sweet' | 'Surprise Me';

export type SearchableRecipe = {
  id: string;
  name: string;
  description: string;
  inspiration: string;
  tags: string[];
  temperature: string;
  ingredients: Array<{ id: string; name: string }>;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function matchesFilter(recipe: SearchableRecipe, filter: Exclude<RecipeFilter, 'Surprise Me'>) {
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

  return matchingQuery.filter((recipe) => matchesFilter(recipe, filter));
}

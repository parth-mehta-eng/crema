import type { Ingredient, MatchClassification, Recipe, RecipeMatch, ServingMultiplier } from '@/types/recipe';

type MatchableRecipe = Pick<Recipe, 'id' | 'ingredients' | 'equipment'>;

const fractionGlyphs = [
  { value: 0.125, glyph: '⅛' },
  { value: 0.25, glyph: '¼' },
  { value: 1 / 3, glyph: '⅓' },
  { value: 0.5, glyph: '½' },
  { value: 2 / 3, glyph: '⅔' },
  { value: 0.75, glyph: '¾' },
] as const;

export function formatScaledQuantity(quantity: number, multiplier: ServingMultiplier): string {
  const scaled = Math.round(quantity * multiplier * 1000) / 1000;
  const whole = Math.floor(scaled);
  const remainder = scaled - whole;
  const fraction = fractionGlyphs.find(({ value }) => Math.abs(value - remainder) < 0.015);

  if (!fraction) {
    return Number(scaled.toFixed(2)).toString();
  }

  return `${whole > 0 ? whole : ''}${fraction.glyph}`;
}

export function formatIngredientAmount(ingredient: Ingredient, multiplier: ServingMultiplier): string {
  const scaledQuantity = Math.round(ingredient.quantity * multiplier * 1000) / 1000;
  const pluralUnits: Record<string, string> = {
    cup: 'cups',
    pinch: 'pinches',
    shot: 'shots',
  };
  const unit = scaledQuantity > 1 ? (pluralUnits[ingredient.unit] ?? ingredient.unit) : ingredient.unit;
  return `${formatScaledQuantity(ingredient.quantity, multiplier)} ${unit}`;
}

export function getRecipeMatch(
  recipe: MatchableRecipe,
  ingredientInventory: readonly string[],
  equipmentInventory: readonly string[],
): RecipeMatch {
  const requiredIngredients = recipe.ingredients.filter((ingredient) => !ingredient.optional);
  const ownedIngredients = requiredIngredients.filter((ingredient) => ingredientInventory.includes(ingredient.id));
  const missingIngredients = requiredIngredients.filter((ingredient) => !ingredientInventory.includes(ingredient.id));
  const requiredEquipment = recipe.equipment;
  const ownedEquipment = requiredEquipment.filter((equipmentId) => equipmentInventory.includes(equipmentId));
  const missingEquipment = requiredEquipment.filter((equipmentId) => !equipmentInventory.includes(equipmentId));
  const classification: MatchClassification =
    missingEquipment.length > 0
      ? 'Equipment Missing'
      : missingIngredients.length === 0
        ? 'Perfect Match'
        : missingIngredients.length === 1
          ? 'Missing 1'
          : missingIngredients.length === 2
            ? 'Missing 2'
            : 'Missing 3+';

  return {
    requiredIngredients,
    ownedIngredients,
    missingIngredients,
    requiredEquipment,
    ownedEquipment,
    missingEquipment,
    classification,
  };
}

export function getCoffeeBarSummary(
  recipes: readonly MatchableRecipe[],
  ingredientInventory: readonly string[],
  equipmentInventory: readonly string[],
) {
  const matches = recipes.map((recipe) => ({
    recipeId: recipe.id,
    match: getRecipeMatch(recipe, ingredientInventory, equipmentInventory),
  }));

  return {
    makeableRecipeIds: matches
      .filter(({ match }) => match.missingIngredients.length === 0 && match.missingEquipment.length === 0)
      .map(({ recipeId }) => recipeId),
    oneIngredientAwayRecipeIds: matches
      .filter(({ match }) => match.missingIngredients.length === 1 && match.missingEquipment.length === 0)
      .map(({ recipeId }) => recipeId),
  };
}

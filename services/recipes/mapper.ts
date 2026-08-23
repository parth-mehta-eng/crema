import type { Difficulty, Recipe, Temperature } from '@/types/recipe';

type RecipeIngredientRow = {
  position: number;
  quantity: number | string;
  unit: string;
  note: string | null;
  optional: boolean;
  display_name?: string | null;
  ingredients: { id: string; name: string } | null;
};

type RecipeEquipmentRow = {
  position: number;
  equipment: { id: string; name: string } | null;
};

type RecipeStepRow = {
  position: number;
  instruction: string;
  timer_seconds: number | null;
};

type RecipeCollectionRow = {
  recipe_collections: { title: string } | null;
};

export type RecipeRow = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  inspiration: string;
  description: string;
  image_url: string;
  image_alt: string | null;
  minutes: number;
  prep_minutes: number | null;
  difficulty: Difficulty;
  temperature: Temperature;
  servings: number;
  cup_size: string;
  tags: string[] | null;
  category: string | null;
  featured: boolean | null;
  sweetness: number | null;
  strength: number | null;
  caffeine_mg: number | null;
  calories: number | null;
  recipe_ingredients: RecipeIngredientRow[] | null;
  recipe_equipment: RecipeEquipmentRow[] | null;
  recipe_steps: RecipeStepRow[] | null;
  published_recipe_collections: RecipeCollectionRow[] | null;
};

function byPosition<T extends { position: number }>(left: T, right: T) {
  return left.position - right.position;
}

export function mapRecipeRow(row: RecipeRow): Recipe {
  const ingredients = [...(row.recipe_ingredients ?? [])]
    .sort(byPosition)
    .flatMap((item) => {
      if (!item.ingredients) return [];

      return [
        {
          id: item.ingredients.id,
          name: item.display_name ?? item.ingredients.name,
          quantity: Number(item.quantity),
          unit: item.unit,
          ...(item.note ? { note: item.note } : {}),
          ...(item.optional ? { optional: true } : {}),
        },
      ];
    });

  const equipment = [...(row.recipe_equipment ?? [])]
    .sort(byPosition)
    .flatMap((item) => (item.equipment ? [item.equipment.id] : []));

  const steps = [...(row.recipe_steps ?? [])].sort(byPosition).map((step) => ({
    instruction: step.instruction,
    ...(step.timer_seconds == null ? {} : { timerSeconds: step.timer_seconds }),
  }));

  const collections = (row.published_recipe_collections ?? []).flatMap((entry) =>
    entry.recipe_collections ? [entry.recipe_collections.title] : [],
  );

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    subtitle: row.subtitle,
    inspiration: row.inspiration,
    description: row.description,
    image: row.image_url,
    minutes: row.minutes,
    difficulty: row.difficulty,
    temperature: row.temperature,
    servings: row.servings,
    cupSize: row.cup_size,
    tags: row.tags ?? [],
    ingredients,
    equipment,
    steps,
    category: row.category ?? 'coffee',
    collections,
    prepMinutes: row.prep_minutes ?? row.minutes,
    featured: row.featured ?? false,
    imageAlt: row.image_alt ?? row.name,
    sweetness: row.sweetness ?? null,
    strength: row.strength ?? null,
    caffeineMg: row.caffeine_mg ?? null,
    calories: row.calories ?? null,
  };
}

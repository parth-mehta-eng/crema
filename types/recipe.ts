export type Temperature = 'Iced' | 'Hot' | 'Either';
export type Difficulty = 'Easy' | 'Medium' | 'Advanced';
export type ServingMultiplier = 1 | 2 | 3;
export type MatchClassification = 'Perfect Match' | 'Missing 1' | 'Missing 2' | 'Missing 3+' | 'Equipment Missing';

export type Ingredient = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  note?: string;
  optional?: boolean;
};

export type RecipeStep = {
  instruction: string;
  timerSeconds?: number;
};

export type Recipe = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  inspiration: string;
  description: string;
  image: string;
  minutes: number;
  difficulty: Difficulty;
  temperature: Temperature;
  servings: number;
  cupSize: string;
  tags: string[];
  ingredients: Ingredient[];
  equipment: string[];
  steps: RecipeStep[];
  /** Content classification, e.g. 'espresso', 'coffee', 'cold brew', 'classic', 'around the world'. */
  category: string;
  /** Titles of the published collections this recipe belongs to (e.g. "Espresso Classics"). */
  collections: string[];
  prepMinutes: number;
  featured: boolean;
  imageAlt: string;
  /** 1-5 scale, unset when the field hasn't been estimated for this recipe. */
  sweetness: number | null;
  strength: number | null;
  /** Estimates only — never treat as an exact measurement. */
  caffeineMg: number | null;
  calories: number | null;
};

export type RecipeMatch = {
  requiredIngredients: Ingredient[];
  ownedIngredients: Ingredient[];
  missingIngredients: Ingredient[];
  requiredEquipment: string[];
  ownedEquipment: string[];
  missingEquipment: string[];
  classification: MatchClassification;
};

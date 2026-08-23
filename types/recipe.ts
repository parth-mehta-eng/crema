export type Temperature = 'Iced' | 'Hot';
export type Difficulty = 'Easy' | 'Medium' | 'Advanced';
export type ServingMultiplier = 1 | 2 | 3;
export type MatchClassification = 'Perfect Match' | 'Missing 1' | 'Missing 2' | 'Missing 3+';

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

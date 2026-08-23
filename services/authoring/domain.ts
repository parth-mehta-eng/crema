export const RECIPE_CATEGORIES = [
  'espresso', 'coffee', 'cold brew', 'matcha', 'tea', 'blended', 'seasonal', 'classic',
  'café inspired', 'Crema original', 'around the world',
] as const;
export const RECIPE_TEMPERATURES = ['hot', 'iced', 'either'] as const;
export const RECIPE_DIFFICULTIES = ['Easy', 'Medium', 'Advanced'] as const;
export const INGREDIENT_UNITS = ['shot', 'oz', 'fl oz', 'cup', 'tbsp', 'tsp', 'mL', 'g', 'pinch', 'pump', 'piece', 'to taste'] as const;
export const DRAFT_STATUSES = ['draft', 'tested', 'ready', 'published', 'archived'] as const;

export type DraftStatus = typeof DRAFT_STATUSES[number];

export type DraftIngredient = {
  id: string;
  ingredientId: string;
  displayName: string;
  quantity: number;
  unit: string;
  preparationNote: string;
  optional: boolean;
  substitutionNotes: string;
  position: number;
};

export type DraftStep = {
  id: string;
  instruction: string;
  timerSeconds: number | null;
  tip: string;
  ingredientRowIds: string[];
  position: number;
};

export type DraftEquipment = {
  equipmentId: string;
  optional: boolean;
  alternativeNote: string;
  position: number;
};

export type AuthoringDraft = {
  id: string;
  proposedTitle: string;
  slug: string;
  description: string;
  inspirationLabel: string;
  sourceName: string;
  sourceUrl: string;
  collectionIds: string[];
  status: DraftStatus;
  featured: boolean;
  tested: boolean;
  category: string;
  temperature: string;
  difficulty: string;
  prepMinutes: number;
  totalMinutes: number;
  servings: number;
  cupSize: string;
  sweetness: number | null;
  strength: number | null;
  caffeineMg: number | null;
  calories: number | null;
  heroImageUrl: string;
  heroImagePath?: string;
  heroImageAlt: string;
  heroImageMime?: string;
  heroImageBytes?: number | null;
  placeholderApproved: boolean;
  needsTesting: boolean;
  flavorNotes: string[];
  ingredients: DraftIngredient[];
  steps: DraftStep[];
  equipment: DraftEquipment[];
  tagIds: string[];
  publishedRecipeId: string | null;
  version?: number;
};

export type DraftValidationError = {
  field: string;
  code: string;
  message: string;
};

export type ExistingSlug = { slug: string; recipeId: string };

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const meaningful = (value: string) => value.trim().toLocaleLowerCase();

export function normalizePositions<T extends { position: number }>(rows: T[]): T[] {
  return rows.map((row, index) => ({ ...row, position: index + 1 }));
}

export function validateDraft(draft: AuthoringDraft, existingSlugs: ExistingSlug[]): DraftValidationError[] {
  const errors: DraftValidationError[] = [];
  const add = (field: string, code: string, message: string) => errors.push({ field, code, message });

  if (!draft.proposedTitle.trim()) add('proposedTitle', 'required', 'Recipe title is required.');
  if (!draft.slug.trim()) add('slug', 'required', 'Slug is required.');
  else if (!slugPattern.test(draft.slug)) add('slug', 'format', 'Use lowercase letters, numbers, and hyphens only.');
  else if (existingSlugs.some((item) => item.slug === draft.slug && item.recipeId !== draft.publishedRecipeId)) {
    add('slug', 'duplicate_slug', 'This slug is already used by another recipe.');
  }
  if (!draft.description.trim()) add('description', 'required', 'Short description is required.');
  if (!RECIPE_CATEGORIES.includes(draft.category as typeof RECIPE_CATEGORIES[number])) add('category', 'required', 'Choose a category.');
  if (!RECIPE_TEMPERATURES.includes(draft.temperature as typeof RECIPE_TEMPERATURES[number])) add('temperature', 'required', 'Choose a temperature.');
  if (!RECIPE_DIFFICULTIES.includes(draft.difficulty as typeof RECIPE_DIFFICULTIES[number])) add('difficulty', 'required', 'Choose a difficulty.');
  if (!Number.isInteger(draft.prepMinutes) || draft.prepMinutes < 1) add('prepMinutes', 'range', 'Preparation time must be at least 1 minute.');
  if (!Number.isInteger(draft.totalMinutes) || draft.totalMinutes < draft.prepMinutes) add('totalMinutes', 'range', 'Total time cannot be shorter than preparation time.');
  if (!Number.isInteger(draft.servings) || draft.servings < 1) add('servings', 'range', 'Serving count must be at least 1.');
  if (!draft.cupSize.trim()) add('cupSize', 'required', 'Default cup size is required.');
  if (!draft.heroImageUrl.trim() && !draft.placeholderApproved) add('heroImageUrl', 'required', 'Upload an approved hero image.');
  if (draft.heroImageUrl.trim() && !draft.heroImageAlt.trim()) add('heroImageAlt', 'required', 'Image alt text is required.');

  const isCafeInspired = meaningful(draft.inspirationLabel).includes('inspired') || draft.category === 'café inspired' || draft.collectionIds.includes('coffee-shop-inspired');
  if (isCafeInspired && !draft.sourceName.trim()) add('sourceName', 'required', 'Café-inspired recipes require a source name.');
  if (isCafeInspired && !/^https:\/\//i.test(draft.sourceUrl.trim())) add('sourceUrl', 'required', 'Café-inspired recipes require an HTTPS source URL.');

  if (!draft.ingredients.length) add('ingredients', 'required', 'Add at least one ingredient.');
  const ingredientKeys = new Set<string>();
  draft.ingredients.forEach((row, index) => {
    if (!row.ingredientId) add(`ingredients.${index}.ingredientId`, 'required', 'Choose an ingredient.');
    if (!Number.isFinite(row.quantity) || row.quantity <= 0) add(`ingredients.${index}.quantity`, 'range', 'Quantity must be greater than zero.');
    if (!INGREDIENT_UNITS.includes(row.unit as typeof INGREDIENT_UNITS[number])) add(`ingredients.${index}.unit`, 'required', 'Choose a supported unit.');
    const key = [row.ingredientId, meaningful(row.displayName), meaningful(row.preparationNote)].join('|');
    if (ingredientKeys.has(key)) add(`ingredients.${index}`, 'duplicate_ingredient', 'Duplicate ingredients need a different preparation or display name.');
    ingredientKeys.add(key);
  });

  if (!draft.steps.length) add('steps', 'required', 'Add at least one preparation step.');
  draft.steps.forEach((step, index) => {
    if (!step.instruction.trim()) add(`steps.${index}.instruction`, 'required', 'Step instruction cannot be empty.');
    if (step.timerSeconds !== null && (!Number.isInteger(step.timerSeconds) || step.timerSeconds < 1)) add(`steps.${index}.timerSeconds`, 'range', 'Timer must be a positive number of seconds.');
  });
  if (!draft.equipment.length) add('equipment', 'required', 'Classify at least one required or optional equipment item.');
  if (!draft.tested || draft.needsTesting) add('tested', 'required', 'Resolve testing and mark the recipe tested.');
  return errors;
}

const transitions: Record<DraftStatus, DraftStatus[]> = {
  draft: ['tested', 'archived'],
  tested: ['draft', 'ready', 'archived'],
  ready: ['tested', 'published', 'archived'],
  published: ['draft', 'archived'],
  archived: ['draft'],
};

export function validateTransition(from: DraftStatus, to: DraftStatus): string | null {
  return transitions[from]?.includes(to) ? null : `Draft cannot move from ${from} to ${to}.`;
}

export function publicationRecipeId(draft: Pick<AuthoringDraft, 'id' | 'publishedRecipeId'>): string {
  return draft.publishedRecipeId ?? draft.id;
}

export function duplicateDraft(draft: AuthoringDraft, newDraftId: string): AuthoringDraft {
  const ingredientIds = new Map<string, string>();
  const ingredients = draft.ingredients.map((row, index) => {
    const id = `${newDraftId}-ingredient-${index + 1}`;
    ingredientIds.set(row.id, id);
    return { ...row, id };
  });
  return {
    ...draft,
    id: newDraftId,
    proposedTitle: `${draft.proposedTitle} Copy`,
    slug: `${draft.slug.replace(/-copy(?:-\d+)?$/, '')}-copy`,
    status: 'draft',
    tested: false,
    needsTesting: true,
    publishedRecipeId: null,
    ingredients,
    steps: draft.steps.map((step, index) => ({
      ...step,
      id: `${newDraftId}-step-${index + 1}`,
      ingredientRowIds: step.ingredientRowIds.map((id) => ingredientIds.get(id) ?? id),
    })),
  };
}

export function formatTimer(seconds: number | null): string {
  if (!seconds) return 'No timer';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (!minutes) return `${remainder} sec`;
  return remainder ? `${minutes} min ${remainder} sec` : `${minutes} min`;
}

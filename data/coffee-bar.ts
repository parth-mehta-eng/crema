export type InventoryCategory = 'Essentials' | 'Milk' | 'Syrups' | 'Sauces' | 'Pantry' | 'Toppings';

export type CoffeeBarOption = {
  id: string;
  name: string;
  category?: InventoryCategory;
};

export const ingredientOptions: CoffeeBarOption[] = [
  { id: 'espresso', name: 'Espresso', category: 'Essentials' },
  { id: 'ice', name: 'Ice', category: 'Essentials' },
  { id: 'water', name: 'Filtered water', category: 'Essentials' },
  { id: 'milk', name: 'Milk', category: 'Milk' },
  { id: 'oat-milk', name: 'Oat milk', category: 'Milk' },
  { id: 'cream', name: 'Heavy cream', category: 'Milk' },
  { id: 'vanilla', name: 'Vanilla syrup', category: 'Syrups' },
  { id: 'pistachio', name: 'Pistachio syrup', category: 'Syrups' },
  { id: 'maple', name: 'Maple syrup', category: 'Syrups' },
  { id: 'caramel-sauce', name: 'Caramel sauce', category: 'Sauces' },
  { id: 'chocolate-sauce', name: 'Chocolate sauce', category: 'Sauces' },
  { id: 'brown-sugar', name: 'Brown sugar', category: 'Pantry' },
  { id: 'cinnamon', name: 'Cinnamon', category: 'Pantry' },
  { id: 'honey', name: 'Honey', category: 'Pantry' },
  { id: 'salt', name: 'Sea salt', category: 'Pantry' },
  { id: 'whipped-cream', name: 'Whipped cream', category: 'Toppings' },
  { id: 'cocoa', name: 'Cocoa powder', category: 'Toppings' },
];

export const equipmentOptions: CoffeeBarOption[] = [
  { id: 'espresso-machine', name: 'Espresso machine' },
  { id: 'grinder', name: 'Grinder' },
  { id: 'milk-frother', name: 'Milk frother' },
  { id: 'nespresso', name: 'Nespresso' },
  { id: 'keurig', name: 'Keurig' },
  { id: 'moka-pot', name: 'Moka pot' },
  { id: 'french-press', name: 'French press' },
  { id: 'pour-over', name: 'Pour-over' },
  { id: 'blender', name: 'Blender' },
  { id: 'shaker', name: 'Shaker' },
];

export const preferenceOptions: CoffeeBarOption[] = [
  { id: 'dairy-free', name: 'Dairy-free' },
  { id: 'less-sweet', name: 'Less sweet' },
  { id: 'decaf', name: 'Decaf' },
  { id: 'extra-strong', name: 'Extra strong' },
];

export const ingredientCategories: InventoryCategory[] = [
  'Essentials',
  'Milk',
  'Syrups',
  'Sauces',
  'Pantry',
  'Toppings',
];

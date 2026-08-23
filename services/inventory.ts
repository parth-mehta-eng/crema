import { supabase } from '@/lib/supabase';

export type UserInventory = {
  ingredients: string[];
  equipment: string[];
};

export async function getUserInventory(userId: string): Promise<UserInventory> {
  if (!supabase) return { ingredients: [], equipment: [] };

  const [ingredientResult, equipmentResult] = await Promise.all([
    supabase.from('user_ingredient_inventory').select('ingredient_id').eq('user_id', userId),
    supabase.from('user_equipment_inventory').select('equipment_id').eq('user_id', userId),
  ]);

  if (ingredientResult.error) throw ingredientResult.error;
  if (equipmentResult.error) throw equipmentResult.error;

  return {
    ingredients: [...new Set((ingredientResult.data ?? []).map((item) => item.ingredient_id))],
    equipment: [...new Set((equipmentResult.data ?? []).map((item) => item.equipment_id))],
  };
}

async function setInventoryItem(
  table: 'user_ingredient_inventory' | 'user_equipment_inventory',
  column: 'ingredient_id' | 'equipment_id',
  userId: string,
  itemId: string,
  selected: boolean,
) {
  if (!supabase) return;

  if (selected) {
    const { error } = await supabase.from(table).upsert(
      { user_id: userId, [column]: itemId },
      { onConflict: `user_id,${column}`, ignoreDuplicates: true },
    );
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from(table)
    .delete()
    .eq('user_id', userId)
    .eq(column, itemId);
  if (error) throw error;
}

export function setUserIngredient(userId: string, ingredientId: string, selected: boolean) {
  return setInventoryItem(
    'user_ingredient_inventory',
    'ingredient_id',
    userId,
    ingredientId,
    selected,
  );
}

export function setUserEquipment(userId: string, equipmentId: string, selected: boolean) {
  return setInventoryItem(
    'user_equipment_inventory',
    'equipment_id',
    userId,
    equipmentId,
    selected,
  );
}

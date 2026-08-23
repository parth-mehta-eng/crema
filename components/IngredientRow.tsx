import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { colors, font, spacing } from '@/constants/theme';
import { formatIngredientAmount } from '@/lib/recipe-utils';
import type { Ingredient, ServingMultiplier } from '@/types/recipe';

type IngredientRowProps = {
  ingredient: Ingredient;
  multiplier?: ServingMultiplier;
  available: boolean;
};

export function IngredientRow({ ingredient, multiplier = 1, available }: IngredientRowProps) {
  const status = ingredient.optional
    ? 'Optional'
    : available
      ? 'You have this'
      : 'Missing';
  const statusColor = ingredient.optional ? colors.textSecondary : available ? colors.sage : colors.amber;

  return (
    <View style={styles.row}>
      <View style={styles.ingredientLine}>
        <AppText style={styles.amount}>{formatIngredientAmount(ingredient, multiplier)}</AppText>
        <View style={styles.nameGroup}>
          <AppText style={styles.name}>{ingredient.name}</AppText>
          {ingredient.note ? <AppText style={styles.note}>{ingredient.note}</AppText> : null}
        </View>
      </View>
      <View style={styles.statusLine}>
        <Ionicons
          name={ingredient.optional ? 'remove-circle-outline' : available ? 'checkmark-circle' : 'alert-circle-outline'}
          size={17}
          color={statusColor}
        />
        <AppText style={[styles.status, { color: statusColor }]}>{status}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ingredientLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: spacing.md,
  },
  amount: {
    width: 82,
    fontFamily: font.medium,
    color: colors.textSecondary,
  },
  nameGroup: {
    flex: 1,
  },
  name: {
    fontFamily: font.medium,
    lineHeight: 20,
  },
  note: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusLine: {
    marginTop: spacing.sm,
    marginLeft: 94,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.xs,
  },
  status: {
    fontFamily: font.medium,
    fontSize: 12,
  },
});

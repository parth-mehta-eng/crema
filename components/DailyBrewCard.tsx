import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Recipe } from '@/types/recipe';
import { AppText, DisplayText } from './AppText';
import { colors, font, radius, shadows, spacing } from '@/constants/theme';
import { getRecipeMatch } from '@/lib/recipe-utils';
import { useCoffeeBarStore } from '@/store/useCoffeeBarStore';

type DailyBrewCardProps = {
  recipe: Recipe;
};

export function DailyBrewCard({ recipe }: DailyBrewCardProps) {
  const ingredients = useCoffeeBarStore((state) => state.ingredients);
  const equipment = useCoffeeBarStore((state) => state.equipment);
  const match = useMemo(() => getRecipeMatch(recipe, ingredients, equipment), [equipment, ingredients, recipe]);

  return (
    <Pressable
      accessibilityLabel={`Open today's Daily Brew: ${recipe.name}`}
      accessibilityRole="button"
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.media}>
        {recipe.image === 'crema://placeholder' ? (
          <View style={[styles.image, styles.placeholderImage]}>
            <Ionicons name="cafe-outline" size={32} color={colors.textMuted} />
          </View>
        ) : (
          <Image
            accessibilityLabel={recipe.imageAlt || recipe.name}
            source={recipe.image}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.eyebrowRow}>
          <Ionicons name="sunny-outline" size={13} color={colors.espresso} />
          <AppText style={styles.eyebrow}>Daily Brew</AppText>
        </View>
        <DisplayText numberOfLines={1} style={styles.title}>
          {recipe.name}
        </DisplayText>
        <AppText numberOfLines={2} style={styles.description}>
          {recipe.description}
        </AppText>
        <View style={styles.metaRow}>
          <AppText style={styles.meta}>{recipe.minutes} min</AppText>
          <AppText style={[styles.meta, match.classification !== 'Perfect Match' && styles.metaWarn]}>
            {match.classification === 'Perfect Match' ? '✓ Perfect Match' : match.classification}
          </AppText>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  pressed: {
    opacity: 0.9,
  },
  media: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.border,
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
  },
  eyebrow: {
    fontFamily: font.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.espresso,
  },
  title: {
    marginTop: 2,
    fontSize: 20,
    lineHeight: 23,
  },
  description: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  metaRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    columnGap: spacing.md,
  },
  meta: {
    fontSize: 11,
    fontFamily: font.medium,
    color: colors.sage,
  },
  metaWarn: {
    color: colors.amber,
  },
});

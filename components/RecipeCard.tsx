import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Recipe } from '@/types/recipe';
import { AppText, DisplayText } from './AppText';
import { colors, font, radius, shadows, spacing } from '@/constants/theme';
import { getRecipeMatch } from '@/lib/recipe-utils';
import { useCoffeeBarStore } from '@/store/useCoffeeBarStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';

type RecipeCardProps = {
  recipe: Recipe;
  compact?: boolean;
  width?: number;
  imageHeight?: number;
  compactImageWidth?: number;
};

export const RecipeCard = memo(function RecipeCard({
  recipe,
  compact = false,
  width = 244,
  imageHeight = 180,
  compactImageWidth = 112,
}: RecipeCardProps) {
  const saved = useFavoritesStore((state) => state.favorites.includes(recipe.id));
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const ingredients = useCoffeeBarStore((state) => state.ingredients);
  const equipment = useCoffeeBarStore((state) => state.equipment);
  const match = useMemo(
    () => getRecipeMatch(recipe, ingredients, equipment),
    [equipment, ingredients, recipe],
  );

  return (
    <Pressable
      accessibilityLabel={`Open ${recipe.name} recipe`}
      accessibilityRole="button"
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      style={({ pressed }) => [
        styles.card,
        compact ? styles.compactCard : { width },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.surface, compact && styles.compactSurface]}>
        <View style={[styles.media, compact && { width: compactImageWidth }]}>
          {recipe.image === 'crema://placeholder' ? (
            <View
              style={[
                styles.image,
                styles.placeholderImage,
                compact ? styles.compactImage : { height: imageHeight },
              ]}
            >
              <Ionicons name="cafe-outline" size={compact ? 28 : 36} color={colors.textMuted} />
            </View>
          ) : (
            <Image
              accessibilityLabel={recipe.imageAlt || recipe.name}
              source={recipe.image}
              style={[styles.image, compact ? styles.compactImage : { height: imageHeight }]}
              contentFit="cover"
              transition={200}
            />
          )}
          <Pressable
            accessibilityLabel={`${saved ? 'Remove' : 'Add'} ${recipe.name} ${saved ? 'from' : 'to'} favorites`}
            accessibilityRole="button"
            hitSlop={4}
            onPress={(event) => {
              event.stopPropagation();
              toggleFavorite(recipe.id);
            }}
            style={({ pressed }) => [styles.heart, pressed && styles.heartPressed]}
          >
            <Ionicons
              name={saved ? 'heart' : 'heart-outline'}
              size={20}
              color={saved ? colors.espresso : colors.text}
            />
          </Pressable>
        </View>

        <View style={[styles.body, compact && styles.compactBody]}>
          <DisplayText numberOfLines={2} style={[styles.title, compact && styles.compactTitle]}>
            {recipe.name}
          </DisplayText>
          <AppText
            numberOfLines={1}
            style={[styles.match, match.classification !== 'Perfect Match' && styles.missing]}
          >
            {match.classification === 'Perfect Match' ? '✓ Perfect Match' : match.classification}
          </AppText>
          <AppText numberOfLines={1} style={styles.meta}>
            {recipe.minutes} min  •  {recipe.difficulty}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    marginRight: spacing.lg,
    borderRadius: radius.card,
    ...shadows.card,
  },
  compactCard: {
    width: '100%',
    marginRight: 0,
    marginBottom: spacing.lg,
  },
  pressed: {
    opacity: 0.9,
  },
  surface: {
    overflow: 'hidden',
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  compactSurface: {
    minHeight: 128,
    flexDirection: 'row',
  },
  media: {
    position: 'relative',
  },
  image: {
    width: '100%',
    backgroundColor: colors.border,
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactImage: {
    height: 128,
  },
  heart: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  heartPressed: {
    opacity: 0.72,
  },
  body: {
    flex: 1,
    padding: spacing.lg,
  },
  compactBody: {
    padding: spacing.md,
  },
  title: {
    minHeight: 54,
    fontSize: 23,
    lineHeight: 27,
  },
  compactTitle: {
    minHeight: 48,
    fontSize: 20,
    lineHeight: 24,
  },
  match: {
    marginTop: spacing.sm,
    fontFamily: font.medium,
    fontSize: 12,
    color: colors.sage,
  },
  missing: {
    color: colors.amber,
  },
  meta: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.textSecondary,
  },
});

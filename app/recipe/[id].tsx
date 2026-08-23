import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { AppText, DisplayText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { IngredientRow } from '@/components/IngredientRow';
import { MetadataItem } from '@/components/MetadataItem';
import { ServingSelector } from '@/components/ServingSelector';
import { equipmentOptions } from '@/data/coffee-bar';
import { getRecipeMatch } from '@/lib/recipe-utils';
import { useCoffeeBarStore } from '@/store/useCoffeeBarStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useRecipesStore } from '@/store/useRecipesStore';
import { colors, font, radius, spacing } from '@/constants/theme';
import type { ServingMultiplier } from '@/types/recipe';

const equipmentNames = new Map(equipmentOptions.map((item) => [item.id, item.name]));

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const recipes = useRecipesStore((state) => state.recipes);
  const recipe = recipes.find((item) => item.id === id);
  const [multiplier, setMultiplier] = useState<ServingMultiplier>(1);
  const saved = useFavoritesStore((state) => (recipe ? state.favorites.includes(recipe.id) : false));
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const ingredients = useCoffeeBarStore((state) => state.ingredients);
  const equipment = useCoffeeBarStore((state) => state.equipment);
  const match = useMemo(
    () => (recipe ? getRecipeMatch(recipe, ingredients, equipment) : null),
    [equipment, ingredients, recipe],
  );

  if (!recipe || !match) {
    return (
      <Screen contentStyle={styles.errorScreen}>
        <EmptyState
          icon="cafe-outline"
          title="Recipe not found"
          body="This recipe is no longer available in the local collection."
          actionLabel="Back to Home"
          onAction={() => router.replace('/')}
        />
      </Screen>
    );
  }

  const heroHeight = Math.min(420, Math.max(300, Math.round(width * 0.86)));

  return (
    <Screen>
      <View style={styles.heroWrap}>
        <Image
          accessibilityLabel={recipe.name}
          source={recipe.image}
          style={[styles.hero, { height: heroHeight }]}
          contentFit="cover"
          transition={200}
        />
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={4}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.floating, styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={23} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityLabel={`${saved ? 'Remove' : 'Add'} ${recipe.name} ${saved ? 'from' : 'to'} favorites`}
          accessibilityRole="button"
          hitSlop={4}
          onPress={() => toggleFavorite(recipe.id)}
          style={({ pressed }) => [styles.floating, styles.favoriteButton, pressed && styles.pressed]}
        >
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} color={colors.espresso} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <AppText style={styles.inspiration}>{recipe.inspiration}</AppText>
        <DisplayText style={styles.title}>{recipe.name}</DisplayText>
        <AppText style={styles.description}>{recipe.description}</AppText>

        <View style={styles.tags}>
          {recipe.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <AppText style={styles.tagText}>{tag}</AppText>
            </View>
          ))}
        </View>

        <View style={styles.metadata}>
          <MetadataItem icon="time-outline" label="Total time" value={`${recipe.minutes} min`} />
          <MetadataItem icon="speedometer-outline" label="Difficulty" value={recipe.difficulty} />
          <MetadataItem icon="people-outline" label="Servings" value={`${recipe.servings * multiplier}`} />
          <MetadataItem icon="cafe-outline" label="Cup size" value={recipe.cupSize} />
        </View>

        <View style={styles.sectionHeadingRow}>
          <View style={styles.sectionHeadingCopy}>
            <DisplayText style={[styles.sectionTitle, styles.ingredientsTitle]}>Ingredients</DisplayText>
            <AppText style={styles.sectionSubtitle}>{match.classification}</AppText>
          </View>
          <ServingSelector value={multiplier} onChange={setMultiplier} />
        </View>

        <View style={styles.ingredientList}>
          {recipe.ingredients.map((ingredient) => (
            <IngredientRow
              key={ingredient.id}
              ingredient={ingredient}
              multiplier={multiplier}
              available={ingredients.includes(ingredient.id)}
            />
          ))}
        </View>

        <DisplayText style={styles.sectionTitle}>Equipment</DisplayText>
        <View style={styles.equipmentList}>
          {recipe.equipment.map((equipmentId) => {
            const available = equipment.includes(equipmentId);
            return (
              <View key={equipmentId} style={styles.equipmentRow}>
                <Ionicons
                  name={available ? 'checkmark-circle' : 'alert-circle-outline'}
                  size={19}
                  color={available ? colors.sage : colors.amber}
                />
                <AppText style={styles.equipmentName}>{equipmentNames.get(equipmentId) ?? equipmentId}</AppText>
                <AppText style={[styles.equipmentStatus, { color: available ? colors.sage : colors.amber }]}>
                  {available ? 'Ready' : 'Missing'}
                </AppText>
              </View>
            );
          })}
        </View>

        <DisplayText style={styles.sectionTitle}>Steps</DisplayText>
        <View style={styles.steps}>
          {recipe.steps.map((step, index) => (
            <View key={`${recipe.id}-${index}`} style={styles.step}>
              <View style={styles.stepNumber}>
                <AppText style={styles.stepNumberText}>{index + 1}</AppText>
              </View>
              <AppText style={styles.stepText}>{step.instruction}</AppText>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/brew/[id]',
              params: { id: recipe.id, servings: multiplier.toString() },
            })
          }
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <AppText style={styles.ctaText}>Start making</AppText>
          <Ionicons name="arrow-forward" size={19} color={colors.white} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  heroWrap: {
    position: 'relative',
  },
  hero: {
    width: '100%',
    backgroundColor: colors.border,
  },
  floating: {
    position: 'absolute',
    top: spacing.lg,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  backButton: {
    left: spacing.lg,
  },
  favoriteButton: {
    right: spacing.lg,
  },
  pressed: {
    opacity: 0.72,
  },
  content: {
    padding: spacing.xl,
  },
  inspiration: {
    fontFamily: font.semibold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.sage,
  },
  title: {
    marginTop: spacing.sm,
    fontSize: 42,
    lineHeight: 44,
  },
  description: {
    marginTop: spacing.md,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  tags: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    minHeight: 32,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.icedBlue,
  },
  tagText: {
    fontFamily: font.medium,
    fontSize: 12,
  },
  metadata: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
    columnGap: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  sectionHeadingRow: {
    marginTop: spacing.xxl,
    alignItems: 'flex-start',
    rowGap: spacing.md,
  },
  sectionHeadingCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
    fontSize: 30,
    lineHeight: 33,
  },
  ingredientsTitle: {
    marginTop: 0,
  },
  sectionSubtitle: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
  ingredientList: {
    marginTop: spacing.sm,
  },
  equipmentList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  equipmentRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  equipmentName: {
    flex: 1,
    fontFamily: font.medium,
  },
  equipmentStatus: {
    fontFamily: font.medium,
    fontSize: 12,
  },
  steps: {
    marginTop: spacing.xs,
  },
  step: {
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 32,
    height: 32,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.icedBlue,
  },
  stepNumberText: {
    fontFamily: font.semibold,
  },
  stepText: {
    flex: 1,
    paddingTop: spacing.xs,
    fontSize: 14,
    lineHeight: 22,
  },
  cta: {
    minHeight: 58,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: colors.espresso,
  },
  ctaPressed: {
    opacity: 0.82,
  },
  ctaText: {
    fontFamily: font.semibold,
    fontSize: 16,
    color: colors.white,
  },
});

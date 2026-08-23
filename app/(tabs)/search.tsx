import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppText, DisplayText } from '@/components/AppText';
import { CategoryChip } from '@/components/CategoryChip';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { RecipeCard } from '@/components/RecipeCard';
import { Screen } from '@/components/Screen';
import { SearchBar } from '@/components/SearchBar';
import { colors, font, radius, spacing } from '@/constants/theme';
import { getRecipeMatch } from '@/lib/recipe-utils';
import { searchRecipes } from '@/services/recipes/repository';
import { isInventoryAwareFilter, type RecipeFilter } from '@/services/recipes/search';
import { useCoffeeBarStore } from '@/store/useCoffeeBarStore';
import { useRecipesStore } from '@/store/useRecipesStore';
import type { Recipe } from '@/types/recipe';

const categories: RecipeFilter[] = [
  'Iced',
  'Hot',
  'Espresso',
  'Coffee',
  'Cold Brew',
  'Matcha',
  'Sweet',
  'Quick',
  'Easy',
  'Coffee Shop Inspired',
  'Around the World',
  'Crema Originals',
  'Can Make Now',
  'Missing One Ingredient',
  'Surprise Me',
];

function validFilter(value: string | undefined): RecipeFilter | null {
  return categories.find((category) => category === value) ?? null;
}

export default function Search() {
  const { filter: routeFilter } = useLocalSearchParams<{ filter?: string }>();
  const recipes = useRecipesStore((state) => state.recipes);
  const ingredientInventory = useCoffeeBarStore((state) => state.ingredients);
  const equipmentInventory = useCoffeeBarStore((state) => state.equipment);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RecipeFilter | null>(() => validFilter(routeFilter));
  const [results, setResults] = useState<Recipe[]>(recipes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      setLoading(true);
      void searchRecipes(query, filter, recipes).then((result) => {
        if (!active) return;
        setResults(result.recipes);
        setError(result.error);
        setLoading(false);
      });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [filter, query, recipes, retryKey]);

  const visibleResults = useMemo(() => {
    if (!isInventoryAwareFilter(filter)) return results;
    return results.filter((recipe) => {
      const match = getRecipeMatch(recipe, ingredientInventory, equipmentInventory);
      if (filter === 'Can Make Now') return match.classification === 'Perfect Match';
      if (filter === 'Missing One Ingredient') return match.classification === 'Missing 1';
      return true;
    });
  }, [equipmentInventory, filter, ingredientInventory, results]);

  const clearSearch = () => {
    setQuery('');
    setFilter(null);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <DisplayText style={styles.title}>Find your next cup</DisplayText>
        <AppText style={styles.subtitle}>Search by drink, flavor, or mood.</AppText>
      </View>

      <SearchBar value={query} onChangeText={setQuery} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {categories.map((category) => (
          <CategoryChip
            key={category}
            label={category}
            selected={filter === category}
            onPress={() => setFilter((current) => (current === category ? null : category))}
          />
        ))}
      </ScrollView>

      {error ? (
        <View style={styles.errorNotice}>
          <AppText style={styles.errorText}>Showing saved recipes. The live search could not refresh.</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRetryKey((current) => current + 1)}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <AppText style={styles.retryText}>Retry</AppText>
          </Pressable>
        </View>
      ) : null}

      {loading && visibleResults.length === 0 ? <LoadingState label="Searching recipes" /> : null}

      {!loading && visibleResults.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No recipes found"
          body="Try another drink, ingredient, flavor, or filter."
          actionLabel="Clear search"
          onAction={clearSearch}
        />
      ) : null}

      {visibleResults.length > 0 ? (
        <View style={styles.list}>
          <AppText style={styles.resultCount}>
            {visibleResults.length} {visibleResults.length === 1 ? 'recipe' : 'recipes'}
          </AppText>
          {loading ? <AppText style={styles.updating}>Updating results…</AppText> : null}
          {visibleResults.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} compact />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  title: {
    fontSize: 38,
    lineHeight: 42,
  },
  subtitle: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
  },
  chips: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    columnGap: spacing.sm,
  },
  errorNotice: {
    marginHorizontal: spacing.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  retryText: {
    fontFamily: font.semibold,
    color: colors.espresso,
  },
  pressed: {
    opacity: 0.7,
  },
  updating: {
    marginBottom: spacing.md,
    color: colors.textSecondary,
  },
  resultCount: {
    marginBottom: spacing.md,
    fontSize: 12,
    fontFamily: font.medium,
    color: colors.textMuted,
  },
  list: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
  },
});

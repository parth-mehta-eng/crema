import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText, DisplayText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { RecipeCard } from '@/components/RecipeCard';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/constants/theme';
import { getRecipesByCollection, type Collection } from '@/services/collections';
import type { Recipe } from '@/types/recipe';

export default function CollectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const task = setTimeout(() => {
      setLoading(true);
      void getRecipesByCollection(id).then((result) => {
        if (!active) return;
        setCollection(result.collection);
        setRecipes(result.recipes);
        setError(result.error);
        setLoading(false);
      });
    }, 0);
    return () => {
      active = false;
      clearTimeout(task);
    };
  }, [id, retryKey]);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={4}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={23} color={colors.text} />
        </Pressable>
        <View style={styles.cover}>
          <Ionicons name="cafe-outline" size={34} color={colors.espresso} />
        </View>
        {collection ? (
          <>
            <DisplayText style={styles.title}>{collection.title}</DisplayText>
            {collection.description ? <AppText style={styles.subtitle}>{collection.description}</AppText> : null}
            <AppText style={styles.count}>
              {collection.recipeCount} {collection.recipeCount === 1 ? 'recipe' : 'recipes'}
            </AppText>
          </>
        ) : null}
      </View>

      {loading ? <LoadingState label="Loading collection" /> : null}

      {!loading && error ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Collection could not load"
          body={error}
          actionLabel="Retry"
          onAction={() => setRetryKey((current) => current + 1)}
        />
      ) : null}

      {!loading && !error && !collection ? (
        <EmptyState
          icon="albums-outline"
          title="Collection not found"
          body="This collection may have been renamed or unpublished."
          actionLabel="See all collections"
          onAction={() => router.replace('/collection')}
        />
      ) : null}

      {!loading && !error && collection && recipes.length === 0 ? (
        <EmptyState
          icon="cafe-outline"
          title="No published recipes yet"
          body="Recipes will appear here once they're tested, validated, and published."
          actionLabel="Back to Home"
          onAction={() => router.replace('/')}
        />
      ) : null}

      {!loading && !error && recipes.length > 0 ? (
        <View style={styles.list}>
          {recipes.map((recipe) => (
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
    paddingTop: spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    marginLeft: -spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  cover: {
    marginTop: spacing.md,
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.icedBlue,
  },
  title: {
    marginTop: spacing.lg,
    fontSize: 34,
    lineHeight: 37,
  },
  subtitle: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
  count: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.textMuted,
  },
  list: {
    paddingHorizontal: spacing.xl,
  },
});

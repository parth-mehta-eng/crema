import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { DisplayText, AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { RecipeCard } from '@/components/RecipeCard';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useRecipesStore } from '@/store/useRecipesStore';
import { colors, spacing } from '@/constants/theme';

export default function Favorites() {
  const { width } = useWindowDimensions();
  const favoriteIds = useFavoritesStore((state) => state.favorites);
  const hydrated = useFavoritesStore((state) => state.hydrated);
  const recipes = useRecipesStore((state) => state.recipes);
  const favorites = recipes.filter((recipe) => favoriteIds.includes(recipe.id));
  const compactImageWidth = width < 360 ? 104 : 112;

  return (
    <Screen>
      <View style={styles.header}>
        <DisplayText style={styles.title}>Favorites</DisplayText>
        <AppText style={styles.subtitle}>Your saved coffee recipes.</AppText>
      </View>

      {!hydrated ? (
        <LoadingState label="Loading favorites" />
      ) : favorites.length > 0 ? (
        <View style={styles.list}>
          {favorites.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              compact
              compactImageWidth={compactImageWidth}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          title="No favorites yet"
          body="Save a recipe and it will appear here."
          actionLabel="Explore recipes"
          onAction={() => router.replace('/')}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  title: {
    fontSize: 40,
    lineHeight: 44,
  },
  subtitle: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
  },
  list: {
    paddingHorizontal: spacing.xl,
  },
});

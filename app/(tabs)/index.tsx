import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { AppText, DisplayText } from '@/components/AppText';
import { DailyBrewCard } from '@/components/DailyBrewCard';
import { Screen } from '@/components/Screen';
import { SearchBar } from '@/components/SearchBar';
import { CategoryChip } from '@/components/CategoryChip';
import { RecipeCard } from '@/components/RecipeCard';
import { colors, font, radius, spacing } from '@/constants/theme';
import { getRecipeMatch } from '@/lib/recipe-utils';
import { CURATED_COLLECTIONS, HOME_COLLECTION_TITLES } from '@/services/collections';
import { getDailyBrew } from '@/services/dailyBrew';
import { useCoffeeBarStore } from '@/store/useCoffeeBarStore';
import { useRecipesStore } from '@/store/useRecipesStore';
import type { Recipe } from '@/types/recipe';

const categories = ['Iced', 'Hot', 'Espresso', 'Sweet', 'Surprise Me'] as const;
const MAX_CARDS_PER_SECTION = 6;

type HomeSection = {
  key: string;
  title: string;
  recipes: Recipe[];
};

export default function Home() {
  const { width } = useWindowDimensions();
  const recipes = useRecipesStore((state) => state.recipes);
  const ingredientInventory = useCoffeeBarStore((state) => state.ingredients);
  const equipmentInventory = useCoffeeBarStore((state) => state.equipment);
  const [dailyBrew, setDailyBrew] = useState<Recipe | null>(null);

  useEffect(() => {
    let active = true;
    void getDailyBrew().then((result) => {
      if (active) setDailyBrew(result.recipe);
    });
    return () => {
      active = false;
    };
  }, []);

  const isSmallScreen = width < 360;
  const featuredCardWidth = Math.min(320, Math.max(232, Math.round((width - spacing.xl - spacing.lg) / 1.2)));
  const featuredImageHeight = Math.min(208, Math.max(180, Math.round(featuredCardWidth * 0.67)));
  const compactImageWidth = isSmallScreen ? 104 : 112;

  const coffeeBarRecipes = useMemo(() => {
    const withMatch = recipes.map((recipe) => ({
      recipe,
      match: getRecipeMatch(recipe, ingredientInventory, equipmentInventory),
    }));
    const rank: Record<string, number> = {
      'Perfect Match': 0,
      'Missing 1': 1,
      'Missing 2': 2,
      'Missing 3+': 3,
      'Equipment Missing': 4,
    };
    return withMatch
      .sort((a, b) => (rank[a.match.classification] ?? 0) - (rank[b.match.classification] ?? 0))
      .slice(0, MAX_CARDS_PER_SECTION)
      .map(({ recipe }) => recipe);
  }, [equipmentInventory, ingredientInventory, recipes]);

  const collectionSections = useMemo<HomeSection[]>(() => {
    return HOME_COLLECTION_TITLES.flatMap((title) => {
      const collection = CURATED_COLLECTIONS.find((entry) => entry.title === title);
      if (!collection) return [];
      const matchingRecipes = recipes.filter((recipe) => recipe.collections.includes(title));
      if (matchingRecipes.length === 0) return [];
      return [
        {
          key: collection.id,
          title,
          recipes: matchingRecipes.slice(0, MAX_CARDS_PER_SECTION),
        },
      ];
    });
  }, [recipes]);

  const quickAndEasy = useMemo(
    () => recipes.filter((recipe) => recipe.prepMinutes <= 5 || recipe.difficulty === 'Easy').slice(0, MAX_CARDS_PER_SECTION),
    [recipes],
  );

  const renderRecipeCard = useCallback(
    ({ item }: { item: Recipe }) => (
      <RecipeCard recipe={item} width={featuredCardWidth} imageHeight={featuredImageHeight} />
    ),
    [featuredCardWidth, featuredImageHeight],
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText style={styles.greeting}>Good morning, Parth</AppText>
          <DisplayText style={[styles.hero, isSmallScreen && styles.heroSmall]}>
            What are we{`\n`}making today?
          </DisplayText>
        </View>

        <Link href="/profile" asChild>
          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            hitSlop={4}
            style={({ pressed }) => [styles.profileButton, pressed && styles.controlPressed]}
          >
            <Ionicons name="person-outline" size={21} color={colors.espresso} />
          </Pressable>
        </Link>
      </View>

      <SearchBar />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {categories.map((category, index) => (
          <CategoryChip
            key={category}
            label={category}
            selected={index === 0}
            onPress={() => router.push({ pathname: '/search', params: { filter: category } })}
          />
        ))}
      </ScrollView>

      {dailyBrew ? (
        <View style={styles.section}>
          <DailyBrewCard recipe={dailyBrew} />
        </View>
      ) : null}

      <View style={[styles.section, styles.firstListSection]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <DisplayText style={[styles.heading, isSmallScreen && styles.headingSmall]}>
              Made for your Coffee Bar
            </DisplayText>
            <AppText style={styles.subtitle}>Based on what you have at home</AppText>
          </View>
          <Link href="/search" asChild>
            <Pressable
              accessibilityRole="button"
              hitSlop={4}
              style={({ pressed }) => [styles.seeAll, pressed && styles.controlPressed]}
            >
              <AppText style={styles.seeAllText}>See all</AppText>
            </Pressable>
          </Link>
        </View>

        <FlatList
          horizontal
          data={coffeeBarRecipes}
          decelerationRate="fast"
          keyExtractor={(recipe) => recipe.id}
          renderItem={renderRecipeCard}
          showsHorizontalScrollIndicator={false}
          style={styles.featuredCarousel}
          contentContainerStyle={styles.featuredList}
        />
      </View>

      {collectionSections.map((section) => (
        <View key={section.key} style={[styles.section, styles.listSection]}>
          <View style={styles.sectionHeader}>
            <DisplayText style={[styles.heading, isSmallScreen && styles.headingSmall]}>{section.title}</DisplayText>
            <Link href={{ pathname: '/collection/[id]', params: { id: section.key } }} asChild>
              <Pressable
                accessibilityRole="button"
                hitSlop={4}
                style={({ pressed }) => [styles.seeAll, pressed && styles.controlPressed]}
              >
                <AppText style={styles.seeAllText}>See all</AppText>
              </Pressable>
            </Link>
          </View>

          <FlatList
            horizontal
            data={section.recipes}
            decelerationRate="fast"
            keyExtractor={(recipe) => recipe.id}
            renderItem={renderRecipeCard}
            showsHorizontalScrollIndicator={false}
            style={styles.featuredCarousel}
            contentContainerStyle={styles.featuredList}
          />
        </View>
      ))}

      {quickAndEasy.length > 0 ? (
        <View style={[styles.section, styles.popularSection]}>
          <View style={styles.sectionHeader}>
            <DisplayText style={[styles.heading, isSmallScreen && styles.headingSmall]}>Quick & Easy</DisplayText>
            <Link href={{ pathname: '/search', params: { filter: 'Quick' } }} asChild>
              <Pressable
                accessibilityRole="button"
                hitSlop={4}
                style={({ pressed }) => [styles.seeAll, pressed && styles.controlPressed]}
              >
                <AppText style={styles.seeAllText}>See all</AppText>
              </Pressable>
            </Link>
          </View>

          <View style={styles.popularList}>
            {quickAndEasy.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} compact compactImageWidth={compactImageWidth} />
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontFamily: font.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  hero: {
    marginTop: spacing.md,
    fontSize: 42,
    lineHeight: 43,
  },
  heroSmall: {
    fontSize: 38,
    lineHeight: 39,
  },
  profileButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
  },
  controlPressed: {
    opacity: 0.7,
  },
  chips: {
    paddingTop: spacing.xl,
    paddingRight: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingLeft: spacing.xl,
    columnGap: spacing.sm,
  },
  section: {
    paddingHorizontal: spacing.xl,
  },
  firstListSection: {
    marginTop: spacing.lg,
  },
  listSection: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: spacing.md,
  },
  sectionCopy: {
    flex: 1,
    minWidth: 0,
  },
  heading: {
    flexShrink: 1,
    fontSize: 28,
    lineHeight: 31,
  },
  headingSmall: {
    fontSize: 25,
    lineHeight: 28,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  seeAll: {
    minWidth: 52,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  seeAllText: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: colors.espresso,
  },
  featuredCarousel: {
    marginHorizontal: -spacing.xl,
  },
  featuredList: {
    paddingTop: spacing.lg,
    paddingRight: spacing.sm,
    paddingBottom: spacing.lg,
    paddingLeft: spacing.xl,
  },
  popularSection: {
    marginTop: spacing.lg,
  },
  popularList: {
    marginTop: spacing.lg,
  },
});

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppText, DisplayText } from '@/components/AppText';
import { InventoryTile } from '@/components/InventoryTile';
import { LoadingState } from '@/components/LoadingState';
import { RecipeCard } from '@/components/RecipeCard';
import { Screen } from '@/components/Screen';
import {
  equipmentOptions,
  ingredientCategories,
  ingredientOptions,
  preferenceOptions,
} from '@/data/coffee-bar';
import { getCoffeeBarSummary } from '@/lib/recipe-utils';
import { useCoffeeBarStore } from '@/store/useCoffeeBarStore';
import { useRecipesStore } from '@/store/useRecipesStore';
import { colors, font, radius, spacing } from '@/constants/theme';

type CoffeeBarTab = 'Ingredients' | 'Equipment' | 'Preferences';
type SummaryFilter = 'makeable' | 'one-away' | null;

const tabs: CoffeeBarTab[] = ['Ingredients', 'Equipment', 'Preferences'];

export default function CoffeeBar() {
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<CoffeeBarTab>('Ingredients');
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>(null);
  const recipes = useRecipesStore((state) => state.recipes);
  const ingredients = useCoffeeBarStore((state) => state.ingredients);
  const equipment = useCoffeeBarStore((state) => state.equipment);
  const preferences = useCoffeeBarStore((state) => state.preferences);
  const hydrated = useCoffeeBarStore((state) => state.hydrated);
  const toggleIngredient = useCoffeeBarStore((state) => state.toggleIngredient);
  const toggleEquipment = useCoffeeBarStore((state) => state.toggleEquipment);
  const togglePreference = useCoffeeBarStore((state) => state.togglePreference);
  const summary = useMemo(
    () => getCoffeeBarSummary(recipes, ingredients, equipment),
    [equipment, ingredients, recipes],
  );
  const compactImageWidth = width < 360 ? 104 : 112;
  const filteredRecipeIds =
    summaryFilter === 'makeable'
      ? summary.makeableRecipeIds
      : summaryFilter === 'one-away'
        ? summary.oneIngredientAwayRecipeIds
        : [];
  const filteredRecipes = recipes.filter((recipe) => filteredRecipeIds.includes(recipe.id));

  return (
    <Screen>
      <View style={styles.header}>
        <DisplayText style={styles.title}>Your Coffee Bar</DisplayText>
        <AppText style={styles.subtitle}>Tell Crema what you keep at home.</AppText>
      </View>

      <View accessibilityRole="tablist" style={styles.tabs}>
        {tabs.map((tab) => {
          const selected = activeTab === tab;
          return (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setActiveTab(tab)}
              style={({ pressed }) => [
                styles.tab,
                selected && styles.selectedTab,
                pressed && styles.pressed,
              ]}
            >
              <AppText style={[styles.tabLabel, selected && styles.selectedTabLabel]}>{tab}</AppText>
            </Pressable>
          );
        })}
      </View>

      {!hydrated ? <LoadingState label="Loading your Coffee Bar" /> : null}

      {hydrated ? <><View style={styles.summaryRow}>
        <Pressable
          accessibilityLabel={`You can make ${summary.makeableRecipeIds.length} drinks`}
          accessibilityRole="button"
          onPress={() => setSummaryFilter((current) => current === 'makeable' ? null : 'makeable')}
          style={({ pressed }) => [
            styles.summaryCard,
            summaryFilter === 'makeable' && styles.summaryCardSelected,
            pressed && styles.pressed,
          ]}
        >
          <AppText style={styles.summaryLabel}>You can make</AppText>
          <DisplayText style={styles.summaryValue}>
            {summary.makeableRecipeIds.length} {summary.makeableRecipeIds.length === 1 ? 'drink' : 'drinks'}
          </DisplayText>
        </Pressable>
        <Pressable
          accessibilityLabel={`One ingredient away from ${summary.oneIngredientAwayRecipeIds.length} more recipes`}
          accessibilityRole="button"
          onPress={() => setSummaryFilter((current) => current === 'one-away' ? null : 'one-away')}
          style={({ pressed }) => [
            styles.summaryCard,
            summaryFilter === 'one-away' && styles.summaryCardSelected,
            pressed && styles.pressed,
          ]}
        >
          <AppText style={styles.summaryLabel}>One ingredient away from</AppText>
          <DisplayText style={styles.summaryValue}>{summary.oneIngredientAwayRecipeIds.length} more</DisplayText>
        </Pressable>
      </View>

      {summaryFilter ? (
        <View style={styles.filteredSection}>
          <DisplayText style={styles.sectionTitle}>
            {summaryFilter === 'makeable' ? 'Ready to make' : 'One ingredient away'}
          </DisplayText>
          {filteredRecipes.length > 0 ? (
            filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                compact
                compactImageWidth={compactImageWidth}
              />
            ))
          ) : (
            <AppText style={styles.noMatches}>No recipes match this view yet.</AppText>
          )}
        </View>
      ) : null}

      {activeTab === 'Ingredients' ? (
        <View style={styles.tabContent}>
          {ingredientCategories.map((category) => {
            const options = ingredientOptions.filter((item) => item.category === category);
            return (
              <View key={category} style={styles.group}>
                <DisplayText style={styles.sectionTitle}>{category}</DisplayText>
                <View style={styles.grid}>
                  {options.map((item) => (
                    <InventoryTile
                      key={item.id}
                      label={item.name}
                      selected={ingredients.includes(item.id)}
                      onPress={() => toggleIngredient(item.id)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {activeTab === 'Equipment' ? (
        <View style={styles.tabContent}>
          <DisplayText style={styles.sectionTitle}>Equipment</DisplayText>
          <View style={styles.grid}>
            {equipmentOptions.map((item) => (
              <InventoryTile
                key={item.id}
                label={item.name}
                selected={equipment.includes(item.id)}
                onPress={() => toggleEquipment(item.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {activeTab === 'Preferences' ? (
        <View style={styles.tabContent}>
          <DisplayText style={styles.sectionTitle}>Preferences</DisplayText>
          <AppText style={styles.preferenceCopy}>Saved locally for the recipes you want to explore.</AppText>
          <View style={styles.grid}>
            {preferenceOptions.map((item) => (
              <InventoryTile
                key={item.id}
                label={item.name}
                selected={preferences.includes(item.id)}
                onPress={() => togglePreference(item.id)}
              />
            ))}
          </View>
        </View>
      ) : null}</> : null}
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
  tabs: {
    marginHorizontal: spacing.xl,
    padding: spacing.xs,
    flexDirection: 'row',
    borderRadius: radius.button,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  selectedTab: {
    backgroundColor: colors.espresso,
  },
  pressed: {
    opacity: 0.72,
  },
  tabLabel: {
    fontFamily: font.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  selectedTabLabel: {
    color: colors.white,
  },
  summaryRow: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    columnGap: spacing.md,
  },
  summaryCard: {
    flex: 1,
    minHeight: 132,
    padding: spacing.lg,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  summaryCardSelected: {
    borderColor: colors.espresso,
  },
  summaryLabel: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  summaryValue: {
    marginTop: spacing.md,
    fontSize: 27,
    lineHeight: 29,
  },
  filteredSection: {
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  noMatches: {
    paddingVertical: spacing.lg,
    color: colors.textSecondary,
  },
  tabContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  group: {
    marginTop: spacing.xxl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
    fontSize: 28,
    lineHeight: 31,
  },
  preferenceCopy: {
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
});

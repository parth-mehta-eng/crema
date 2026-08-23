import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { AppText, DisplayText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { IngredientRow } from '@/components/IngredientRow';
import { Screen } from '@/components/Screen';
import { Timer } from '@/components/Timer';
import { useCoffeeBarStore } from '@/store/useCoffeeBarStore';
import { useRecipesStore } from '@/store/useRecipesStore';
import { colors, font, radius, spacing } from '@/constants/theme';
import type { ServingMultiplier } from '@/types/recipe';

function parseMultiplier(value: string | undefined): ServingMultiplier {
  return value === '2' ? 2 : value === '3' ? 3 : 1;
}

export default function BrewingMode() {
  useKeepAwake();
  const { id, servings } = useLocalSearchParams<{ id: string; servings?: string }>();
  const recipes = useRecipesStore((state) => state.recipes);
  const recipe = recipes.find((item) => item.id === id);
  const ingredientInventory = useCoffeeBarStore((state) => state.ingredients);
  const [stepIndex, setStepIndex] = useState(0);
  const [ingredientsVisible, setIngredientsVisible] = useState(false);
  const multiplier = parseMultiplier(servings);

  if (!recipe) {
    return (
      <Screen contentStyle={styles.errorScreen}>
        <EmptyState
          icon="cafe-outline"
          title="Recipe not found"
          body="Brewing Mode could not find this recipe."
          actionLabel="Back to Home"
          onAction={() => router.replace('/')}
        />
      </Screen>
    );
  }

  const step = recipe.steps[stepIndex];
  if (!step) return null;
  const lastStep = stepIndex === recipe.steps.length - 1;
  const progress = ((stepIndex + 1) / recipe.steps.length) * 100;

  const advance = () => {
    if (lastStep) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.back();
      return;
    }
    setStepIndex((current) => current + 1);
  };

  return (
    <Screen scroll={false} contentStyle={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Close Brewing Mode"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <AppText style={styles.stepCount}>Step {stepIndex + 1} of {recipe.steps.length}</AppText>
        <Pressable
          accessibilityLabel="Open ingredient reference"
          accessibilityRole="button"
          onPress={() => setIngredientsVisible(true)}
          style={({ pressed }) => [styles.ingredientsButton, pressed && styles.pressed]}
        >
          <Ionicons name="list" size={18} color={colors.espresso} />
          <AppText style={styles.ingredientsButtonText}>Ingredients</AppText>
        </Pressable>
      </View>

      <View
        accessibilityLabel={`Brewing progress, step ${stepIndex + 1} of ${recipe.steps.length}`}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: recipe.steps.length, now: stepIndex + 1 }}
        style={styles.progressTrack}
      >
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.stepBody}
        showsVerticalScrollIndicator={false}
      >
        <AppText style={styles.recipeName}>{recipe.name}</AppText>
        <DisplayText style={styles.instruction}>{step.instruction}</DisplayText>
        {step.timerSeconds ? <Timer key={stepIndex} durationSeconds={step.timerSeconds} /> : null}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: stepIndex === 0 }}
          disabled={stepIndex === 0}
          onPress={() => setStepIndex((current) => Math.max(0, current - 1))}
          style={({ pressed }) => [
            styles.secondary,
            stepIndex === 0 && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <AppText style={styles.secondaryText}>Back</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={advance}
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
        >
          <AppText style={styles.primaryText}>{lastStep ? 'Complete' : 'Next'}</AppText>
          <Ionicons name={lastStep ? 'checkmark' : 'arrow-forward'} size={19} color={colors.white} />
        </Pressable>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => setIngredientsVisible(false)}
        presentationStyle="pageSheet"
        visible={ingredientsVisible}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View>
              <DisplayText style={styles.modalTitle}>Ingredients</DisplayText>
              <AppText style={styles.modalSubtitle}>{multiplier}x serving</AppText>
            </View>
            <Pressable
              accessibilityLabel="Close ingredient reference"
              accessibilityRole="button"
              onPress={() => setIngredientsVisible(false)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {recipe.ingredients.map((ingredient) => (
              <IngredientRow
                key={ingredient.id}
                ingredient={ingredient}
                multiplier={multiplier}
                available={ingredientInventory.includes(ingredient.id)}
              />
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  screen: {
    padding: spacing.lg,
  },
  topBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    backgroundColor: colors.surface,
  },
  stepCount: {
    fontFamily: font.semibold,
    fontSize: 13,
  },
  ingredientsButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.xs,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
  },
  ingredientsButtonText: {
    fontFamily: font.medium,
    fontSize: 12,
    color: colors.espresso,
  },
  progressTrack: {
    height: 6,
    marginTop: spacing.lg,
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.espresso,
  },
  stepBody: {
    flexGrow: 1,
    paddingVertical: spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeName: {
    fontFamily: font.semibold,
    fontSize: 12,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  instruction: {
    maxWidth: 520,
    marginTop: spacing.lg,
    fontSize: 40,
    lineHeight: 45,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    columnGap: spacing.md,
  },
  secondary: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
  },
  primary: {
    flex: 1.35,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: colors.espresso,
  },
  disabled: {
    opacity: 0.42,
  },
  pressed: {
    opacity: 0.7,
  },
  primaryPressed: {
    opacity: 0.82,
  },
  secondaryText: {
    fontFamily: font.semibold,
  },
  primaryText: {
    fontFamily: font.semibold,
    color: colors.white,
  },
  modalSafe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 32,
    lineHeight: 35,
  },
  modalSubtitle: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
  modalContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
});

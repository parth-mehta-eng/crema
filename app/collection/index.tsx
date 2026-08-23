import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText, DisplayText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { Screen } from '@/components/Screen';
import { colors, font, radius, shadows, spacing } from '@/constants/theme';
import { getCollections, type Collection } from '@/services/collections';

export default function CollectionList() {
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    const task = setTimeout(() => {
      setLoading(true);
      void getCollections().then((result) => {
        if (!active) return;
        setCollections(result.collections);
        setError(result.error);
        setLoading(false);
      });
    }, 0);
    return () => {
      active = false;
      clearTimeout(task);
    };
  }, [retryKey]);

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
        <DisplayText style={styles.title}>Collections</DisplayText>
        <AppText style={styles.subtitle}>Curated sets of Crema recipes to explore.</AppText>
      </View>

      {loading ? <LoadingState label="Loading collections" /> : null}

      {!loading && error ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Collections could not load"
          body={error}
          actionLabel="Retry"
          onAction={() => setRetryKey((current) => current + 1)}
        />
      ) : null}

      {!loading && !error && collections && collections.filter((c) => c.recipeCount > 0).length === 0 ? (
        <EmptyState
          icon="albums-outline"
          title="No collections yet"
          body="Published recipes will appear here as collections fill in."
          actionLabel="Back to Home"
          onAction={() => router.replace('/')}
        />
      ) : null}

      {!loading && !error && collections ? (
        <View style={styles.list}>
          {collections
            .filter((collection) => collection.recipeCount > 0)
            .map((collection) => (
              <Pressable
                key={collection.id}
                accessibilityRole="button"
                onPress={() => router.push(`/collection/${collection.id}`)}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <View style={styles.cardCover}>
                  <Ionicons name="cafe-outline" size={28} color={colors.espresso} />
                </View>
                <View style={styles.cardBody}>
                  <DisplayText numberOfLines={1} style={styles.cardTitle}>
                    {collection.title}
                  </DisplayText>
                  {collection.description ? (
                    <AppText numberOfLines={2} style={styles.cardDescription}>
                      {collection.description}
                    </AppText>
                  ) : null}
                  <AppText style={styles.cardCount}>
                    {collection.recipeCount} {collection.recipeCount === 1 ? 'recipe' : 'recipes'}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
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
  title: {
    marginTop: spacing.sm,
    fontSize: 34,
    lineHeight: 37,
  },
  subtitle: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
  list: {
    paddingHorizontal: spacing.xl,
    rowGap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  cardCover: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.icedBlue,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: spacing.md,
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: 23,
  },
  cardDescription: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  cardCount: {
    marginTop: spacing.xs,
    fontSize: 11,
    fontFamily: font.medium,
    color: colors.textMuted,
  },
});

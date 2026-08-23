import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, DisplayText } from './AppText';
import { colors, font, radius, spacing } from '@/constants/theme';

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
};

export function EmptyState({ icon = 'heart-outline', title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={28} color={colors.espresso} />
      </View>
      <DisplayText style={styles.title}>{title}</DisplayText>
      <AppText style={styles.body}>{body}</AppText>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <AppText style={styles.actionLabel}>{actionLabel}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  icon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.icedBlue,
  },
  title: {
    marginTop: spacing.lg,
    fontSize: 28,
    lineHeight: 32,
    textAlign: 'center',
  },
  body: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  action: {
    minWidth: 152,
    minHeight: 48,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    backgroundColor: colors.espresso,
  },
  pressed: {
    opacity: 0.78,
  },
  actionLabel: {
    fontFamily: font.semibold,
    color: colors.white,
  },
});

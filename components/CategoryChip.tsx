import { Pressable, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { colors, font, radius, spacing } from '@/constants/theme';

type CategoryChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function CategoryChip({ label, selected = false, onPress }: CategoryChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      <AppText style={[styles.label, selected && styles.selectedText]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 46,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  selected: {
    borderColor: colors.espresso,
    backgroundColor: colors.espresso,
  },
  pressed: {
    opacity: 0.78,
  },
  label: {
    fontFamily: font.medium,
    fontSize: 14,
    color: colors.text,
  },
  selectedText: {
    color: colors.white,
  },
});

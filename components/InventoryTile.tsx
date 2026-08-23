import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { colors, font, radius, spacing } from '@/constants/theme';

type InventoryTileProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function InventoryTile({ label, selected, onPress }: InventoryTileProps) {
  return (
    <Pressable
      accessibilityLabel={`${label}, ${selected ? 'selected' : 'not selected'}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={selected ? 'checkmark-circle' : 'add-circle-outline'}
        size={22}
        color={selected ? colors.sage : colors.textMuted}
      />
      <AppText numberOfLines={2} style={[styles.label, selected && styles.selectedLabel]}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '48%',
    minHeight: 92,
    padding: spacing.md,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
  },
  selected: {
    borderColor: colors.sage,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.75,
  },
  label: {
    marginTop: spacing.sm,
    fontFamily: font.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  selectedLabel: {
    color: colors.sage,
  },
});

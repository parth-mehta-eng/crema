import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, font, radius, spacing } from '@/constants/theme';
import type { ServingMultiplier } from '@/types/recipe';

const multipliers: ServingMultiplier[] = [1, 2, 3];

type ServingSelectorProps = {
  value: ServingMultiplier;
  onChange: (value: ServingMultiplier) => void;
};

export function ServingSelector({ value, onChange }: ServingSelectorProps) {
  return (
    <View accessibilityLabel="Serving multiplier" accessibilityRole="radiogroup" style={styles.group}>
      {multipliers.map((multiplier) => {
        const selected = value === multiplier;
        return (
          <Pressable
            key={multiplier}
            accessibilityLabel={`${multiplier} times serving`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(multiplier)}
            style={({ pressed }) => [
              styles.option,
              selected && styles.selected,
              pressed && styles.pressed,
            ]}
          >
            <AppText style={[styles.label, selected && styles.selectedLabel]}>{multiplier}x</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    columnGap: spacing.sm,
  },
  option: {
    minWidth: 52,
    height: 44,
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
    opacity: 0.75,
  },
  label: {
    fontFamily: font.semibold,
    fontSize: 13,
  },
  selectedLabel: {
    color: colors.white,
  },
});

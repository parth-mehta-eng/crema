import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing } from '@/constants/theme';

type SearchBarProps = {
  value?: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
};

export function SearchBar({ value, onChangeText, placeholder = 'Search recipes, ingredients, or cafés...' }: SearchBarProps) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="search" size={20} color={colors.textSecondary} />
      <TextInput
        accessibilityLabel="Search recipes"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 58,
    marginHorizontal: spacing.xl,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.search,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontFamily: font.body,
    fontSize: 14,
    color: colors.text,
  },
});

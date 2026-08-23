import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { colors, font, spacing } from '@/constants/theme';

type MetadataItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

export function MetadataItem({ icon, label, value }: MetadataItemProps) {
  return (
    <View style={styles.item}>
      <Ionicons name={icon} size={18} color={colors.espresso} />
      <View style={styles.copy}>
        <AppText style={styles.label}>{label}</AppText>
        <AppText style={styles.value}>{value}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    minWidth: '45%',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
  },
  copy: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    color: colors.textMuted,
  },
  value: {
    marginTop: spacing.xs,
    fontFamily: font.semibold,
    fontSize: 13,
  },
});

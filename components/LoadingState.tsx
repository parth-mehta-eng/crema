import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, spacing } from '@/constants/theme';

type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.container}>
      <ActivityIndicator color={colors.espresso} />
      <AppText style={styles.label}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
});

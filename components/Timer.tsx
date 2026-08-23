import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppText, DisplayText } from './AppText';
import { colors, font, radius, spacing } from '@/constants/theme';

type TimerProps = {
  durationSeconds: number;
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function Timer({ durationSeconds }: TimerProps) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [running, setRunning] = useState(false);
  const completionAnnounced = useRef(false);

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (remaining !== 0 || completionAnnounced.current) return;
    completionAnnounced.current = true;
    setRunning(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [remaining]);

  const reset = () => {
    setRemaining(durationSeconds);
    setRunning(false);
    completionAnnounced.current = false;
  };

  const complete = remaining === 0;

  return (
    <View style={styles.timer} accessibilityLabel={`Timer, ${formatTime(remaining)} remaining`}>
      <AppText style={styles.eyebrow}>{complete ? 'Timer complete' : 'Step timer'}</AppText>
      <DisplayText accessibilityLiveRegion="polite" style={styles.time}>
        {formatTime(remaining)}
      </DisplayText>
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={running ? 'Pause timer' : 'Start timer'}
          accessibilityRole="button"
          disabled={complete}
          onPress={() => setRunning((value) => !value)}
          style={({ pressed }) => [styles.primary, complete && styles.disabled, pressed && styles.pressed]}
        >
          <Ionicons name={running ? 'pause' : 'play'} size={18} color={colors.white} />
          <AppText style={styles.primaryText}>{running ? 'Pause' : 'Start'}</AppText>
        </Pressable>
        <Pressable
          accessibilityLabel="Reset timer"
          accessibilityRole="button"
          onPress={reset}
          style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
        >
          <Ionicons name="refresh" size={18} color={colors.espresso} />
          <AppText style={styles.resetText}>Reset</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timer: {
    width: '100%',
    padding: spacing.lg,
    alignItems: 'center',
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  eyebrow: {
    fontFamily: font.semibold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  time: {
    marginTop: spacing.xs,
    fontSize: 42,
    lineHeight: 46,
  },
  actions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    columnGap: spacing.sm,
  },
  primary: {
    minWidth: 104,
    height: 44,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: colors.espresso,
  },
  reset: {
    minWidth: 104,
    height: 44,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.72,
  },
  primaryText: {
    fontFamily: font.semibold,
    color: colors.white,
  },
  resetText: {
    fontFamily: font.semibold,
    color: colors.espresso,
  },
});

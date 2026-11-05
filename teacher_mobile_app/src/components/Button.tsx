import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

export default function Button({
  title,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'light';
  busy?: boolean;
  disabled?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
}) {
  const ink = variant === 'primary' ? colors.white : variant === 'light' ? colors.accentDark : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : variant === 'light' ? styles.light : styles.outline,
        (disabled || busy) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={ink} />
      ) : (
        <View style={styles.inner}>
          {icon && <Ionicons name={icon} size={18} color={ink} />}
          <Text style={[styles.text, { color: ink }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: { backgroundColor: colors.accent },
  light: { backgroundColor: colors.white },
  outline: { borderWidth: 1.5, borderColor: colors.divider },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  text: { fontFamily: fonts.heading, fontSize: 15 },
});

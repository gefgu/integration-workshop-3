import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme';

export default function Button({
  title,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
  busy?: boolean;
  disabled?: boolean;
}) {
  const outline = variant === 'outline';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        outline ? styles.outline : styles.primary,
        (disabled || busy) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={outline ? colors.text : colors.bg} />
      ) : (
        <Text style={[styles.text, { color: outline ? colors.text : colors.bg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 999, paddingVertical: 13, paddingHorizontal: 20, alignItems: 'center', minHeight: 48 },
  primary: { backgroundColor: colors.accent },
  outline: { borderWidth: 1, borderColor: colors.divider },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  text: { fontFamily: fonts.heading, fontSize: 15 },
});

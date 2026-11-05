/** Small shared pieces for the teacher app screens: icons, cards, pills, empty states, progress bars. */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, ui } from '../theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 22, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

type Tone = 'neutral' | 'ok' | 'warn' | 'accent';
const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surface, fg: colors.text },
  ok: { bg: colors.oliveSoft, fg: colors.oliveDark },
  warn: { bg: colors.accentSoft, fg: colors.accentDark },
  accent: { bg: colors.accent, fg: colors.white },
};

/** A card with an icon badge and a title; `right` sits at the end of the title row. */
export function Card({
  icon,
  title,
  tone = 'neutral',
  right,
  children,
  onPress,
}: {
  icon?: IconName;
  title?: string;
  tone?: Tone;
  right?: ReactNode;
  children?: ReactNode;
  onPress?: () => void;
}) {
  const t = TONES[tone];
  const body = (
    <>
      {(icon || title || right) && (
        <View style={styles.cardHead}>
          {icon && (
            <View style={[styles.badge, { backgroundColor: tone === 'accent' ? 'rgba(255,255,255,0.2)' : colors.white }]}>
              <Icon name={icon} size={20} color={tone === 'accent' ? colors.white : colors.accentDark} />
            </View>
          )}
          {title ? <Text style={[ui.h2, { color: t.fg, flex: 1 }]}>{title}</Text> : <View style={{ flex: 1 }} />}
          {right}
        </View>
      )}
      {children}
    </>
  );
  const style = [ui.card, { backgroundColor: t.bg }];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [style, pressed && { opacity: 0.85 }]}>
      {body}
    </Pressable>
  );
}

export function Pill({ text, tone = 'neutral', icon }: { text: string; tone?: Tone; icon?: IconName }) {
  const t = TONES[tone === 'neutral' ? 'neutral' : tone];
  return (
    <View style={[styles.pill, { backgroundColor: tone === 'neutral' ? colors.white : t.bg }]}>
      {icon && <Icon name={icon} size={13} color={t.fg} />}
      <Text style={[styles.pillText, { color: t.fg }]}>{text}</Text>
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <View style={[styles.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

/** Loading, empty and error states with an icon and one line of help. */
export function StateView({
  icon = 'information-circle-outline',
  title,
  text,
  loading = false,
  children,
}: {
  icon?: IconName;
  title?: string;
  text?: string;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <View style={styles.state}>
      {loading ? <ActivityIndicator color={colors.accent} size="large" /> : <Icon name={icon} size={44} color={colors.muted} />}
      {title ? <Text style={[ui.h2, { textAlign: 'center' }]}>{title}</Text> : null}
      {text ? <Text style={[ui.muted, { textAlign: 'center', fontSize: 14 }]}>{text}</Text> : null}
      {children}
    </View>
  );
}

/** A tappable list row: icon or initial, title, detail, and a chevron or a custom end. */
export function Row({
  icon,
  initial,
  title,
  detail,
  end,
  selected = false,
  onPress,
  children,
}: {
  icon?: IconName;
  initial?: string;
  title: string;
  detail?: string;
  end?: ReactNode;
  selected?: boolean;
  onPress?: () => void;
  children?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected } : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected && { borderColor: colors.accent, borderWidth: 2, padding: 13 },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.rowMain}>
        {initial ? (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial.slice(0, 1).toUpperCase()}</Text>
          </View>
        ) : icon ? (
          <View style={[styles.badge, { backgroundColor: colors.white }]}>
            <Icon name={icon} size={20} color={colors.accentDark} />
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[ui.text, { fontFamily: fonts.bodyBold }]}>{title}</Text>
          {detail ? <Text style={ui.muted}>{detail}</Text> : null}
        </View>
        {end ?? (onPress ? <Icon name={selected ? 'checkmark-circle' : 'chevron-forward'} size={22} color={selected ? colors.accent : colors.muted} /> : null)}
      </View>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  track: { height: 8, borderRadius: 999, backgroundColor: colors.white, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, backgroundColor: colors.olive },
  state: { alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 24 },
  row: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, gap: 10 },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.heading, fontSize: 18, color: colors.white },
});

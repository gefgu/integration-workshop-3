/** Same palette and fonts as the teacher website (teacher_authoring_app/src/styles.css). */
import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#f5ead8',
  surface: '#ebddc5',
  text: '#201e1d',
  muted: '#7c7465',
  divider: 'rgba(32,30,29,0.16)',
  accent: '#c67139',
  accentDark: '#8a4a22',
  accentSoft: '#fbd9c2',
  olive: '#7a8a5e',
  oliveSoft: '#e1eecc',
  oliveDark: '#3d472b',
  white: '#f9f4ed',
};

export const fonts = {
  heading: 'Caprasimo_400Regular',
  body: 'Figtree_400Regular',
  bodyBold: 'Figtree_700Bold',
};

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  h1: { fontFamily: fonts.heading, fontSize: 26, color: colors.text },
  h2: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  text: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: 16, gap: 8 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  input: {
    fontFamily: fonts.body,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    color: colors.text,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.accentDark,
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    padding: 10,
  },
  ok: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.oliveDark,
    backgroundColor: colors.oliveSoft,
    borderRadius: 12,
    padding: 10,
  },
});

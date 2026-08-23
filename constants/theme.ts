export const colors = {
  background: '#F8F4EE',
  surface: '#FFFDF9',
  espresso: '#3A2418',
  caramel: '#C8A67A',
  icedBlue: '#DCECF8',
  sage: '#5F8A66',
  amber: '#C98A2E',
  text: '#231A14',
  textSecondary: '#6E625A',
  textMuted: '#9B9088',
  border: '#E8DED4',
  white: '#FFFFFF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 12, button: 16, search: 18, card: 20, modal: 28, pill: 999 } as const;
export const shadows = {
  card: { shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
};
export const font = {
  display: 'CormorantGaramond_600SemiBold',
  displayRegular: 'CormorantGaramond_500Medium',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

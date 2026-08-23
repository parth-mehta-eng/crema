import { Text, TextProps } from 'react-native';
import { colors, font } from '@/constants/theme';

export function AppText({ style, ...props }: TextProps) { return <Text {...props} style={[{ fontFamily: font.body, color: colors.text }, style]} />; }
export function DisplayText({ style, ...props }: TextProps) { return <Text {...props} style={[{ fontFamily: font.display, color: colors.text }, style]} />; }

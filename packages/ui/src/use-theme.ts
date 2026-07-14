import { useContext } from 'react';
import { useColorScheme } from 'react-native';

import { colors, type ColorScheme, type Palette, type Theme } from './theme';
import { ThemeContext } from './theme-context';

/**
 * Resolves the active theme. Reads the scheme from {@link ThemeProvider} when
 * one is mounted (so an app can force light/dark or expose a toggle), otherwise
 * falls back to the OS color scheme.
 *
 * This is the ONLY place the color scheme is resolved; components consume
 * `colors`/`scheme` from here and never import the raw palette directly.
 */
export function useTheme(): Theme {
  const forced = useContext(ThemeContext);
  const system = useColorScheme();
  const scheme: ColorScheme = (forced ?? (system === 'dark' ? 'dark' : 'light'));
  return { scheme, colors: colors[scheme] };
}

export type { Palette, ColorScheme, Theme };

import type { ReactNode } from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';

import type { ColorScheme } from './theme';
import { layout } from './theme';
import { ThemeContext } from './theme-context';

export interface ThemeProviderProps {
  children: ReactNode;
  /**
   * Force a color scheme regardless of the OS setting. Omit (or pass
   * `undefined`) to follow the system scheme.
   */
  scheme?: ColorScheme;
}

/**
 * Provides the resolved color scheme to the tree. Wrap the app root once; every
 * `useTheme()` below reads from here. With no `scheme` prop the OS scheme is
 * used, so the provider is optional — `useTheme()` degrades to `useColorScheme`.
 */
export function ThemeProvider({ children, scheme }: ThemeProviderProps) {
  const system = useColorScheme();
  const resolved: ColorScheme = scheme ?? (system === 'dark' ? 'dark' : 'light');
  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>;
}

export interface Responsive {
  /** Current viewport width in px. */
  width: number;
  /** Current viewport height in px. */
  height: number;
  /** True once the viewport is wide enough for the desktop/wide layout. */
  isWide: boolean;
}

/**
 * Live viewport size + an `isWide` flag driving the wide-vs-narrow layout
 * switch at {@link layout.breakpointDesktop}. Uses `useWindowDimensions()` so
 * resizing a browser window re-renders across the breakpoint.
 */
export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  return { width, height, isWide: width >= layout.breakpointDesktop };
}

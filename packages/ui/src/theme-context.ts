import { createContext } from 'react';

import type { ColorScheme } from './theme';

/**
 * Resolved color scheme provided by {@link ThemeProvider}. `null` means "no
 * provider mounted" — {@link useTheme} then falls back to the OS scheme via
 * `useColorScheme()`. Kept in its own module so the provider (a component) and
 * the hook can share the context without a circular import.
 */
export const ThemeContext = createContext<ColorScheme | null>(null);

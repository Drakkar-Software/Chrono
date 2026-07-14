import { Host, Button as SwiftUIButton } from '@expo/ui/swift-ui';
import { Button as ComposeButton } from '@expo/ui/jetpack-compose';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { opacity } from '../theme';
import { useTheme } from '../use-theme';
import { buttonColors, buttonMetrics } from './Button.styles';
import type { ButtonProps, ButtonVariant } from './Button.types';
import { Txt } from './Txt';

// Map our variant to the closest SwiftUI/Compose button role/variant. Kept
// minimal because the @expo/ui API is alpha; colors come from the theme.
function nativeVariant(variant: ButtonVariant): 'borderedProminent' | 'bordered' | 'plain' {
  if (variant === 'primary' || variant === 'danger') return 'borderedProminent';
  if (variant === 'secondary') return 'bordered';
  return 'plain';
}

/**
 * Native Button built on `@expo/ui` (SwiftUI on iOS, Jetpack Compose on
 * Android) inside a `Host`. Colors and role derive from the theme + variant. A
 * `loading` state (which the native primitives don't express) falls back to a
 * themed `Pressable` spinner so the interface matches the web implementation.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
}: ButtonProps) {
  const { colors } = useTheme();
  const c = buttonColors(colors, variant);
  const m = buttonMetrics(size);
  const blocked = disabled || loading;
  const hostStyle = [styles.host, fullWidth ? styles.full : styles.auto, { height: m.height }];

  // Loading isn't expressible on the native button — render a themed pressable
  // that mirrors the web look so the busy state is consistent cross-platform.
  if (loading) {
    return (
      <View
        style={[
          styles.loadingBase,
          {
            height: m.height,
            paddingHorizontal: m.paddingHorizontal,
            borderRadius: m.radius,
            borderWidth: m.borderWidth,
            backgroundColor: c.bg,
            borderColor: c.border,
            opacity: opacity.disabled,
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
          },
        ]}
      >
        <ActivityIndicator size="small" color={c.text} style={styles.spinner} />
        <Txt variant={m.fontVariant} weight="semibold" color={c.text}>
          {title}
        </Txt>
      </View>
    );
  }

  if (Platform.OS === 'android') {
    return (
      <Host style={hostStyle} matchContents>
        <ComposeButton
          variant={nativeVariant(variant)}
          color={c.bg}
          disabled={blocked}
          onPress={onPress}
        >
          {title}
        </ComposeButton>
      </Host>
    );
  }

  return (
    <Host style={hostStyle} matchContents>
      <SwiftUIButton
        variant={nativeVariant(variant)}
        color={variant === 'ghost' ? colors.accent : c.bg}
        role={variant === 'danger' ? 'destructive' : undefined}
        disabled={blocked}
        onPress={onPress}
      >
        {title}
      </SwiftUIButton>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { justifyContent: 'center' },
  auto: { alignSelf: 'flex-start' },
  full: { alignSelf: 'stretch', width: '100%' },
  loadingBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  spinner: { marginRight: 8 },
});

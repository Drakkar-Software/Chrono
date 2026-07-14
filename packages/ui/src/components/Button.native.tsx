import { Host, Button as SwiftUIButton } from '@expo/ui/swift-ui';
import { buttonStyle, disabled as disabledModifier, tint } from '@expo/ui/swift-ui/modifiers';
import { Button as ComposeButton } from '@expo/ui/jetpack-compose';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { opacity } from '../theme';
import { useTheme } from '../use-theme';
import { buttonColors, buttonMetrics } from './Button.styles';
import type { ButtonProps, ButtonVariant } from './Button.types';
import { Txt } from './Txt';

// Map our variant to the closest SwiftUI native button style. `borderedProminent`
// gives primary/danger a filled look, `bordered` an outlined one, and `plain` a
// text-only ghost. The accent tint / destructive role carries the color.
function swiftButtonStyle(variant: ButtonVariant): 'borderedProminent' | 'bordered' | 'plain' {
  if (variant === 'primary' || variant === 'danger') return 'borderedProminent';
  if (variant === 'secondary') return 'bordered';
  return 'plain';
}

/**
 * Native Button built on `@expo/ui` (SwiftUI on iOS, Jetpack Compose on
 * Android) inside a `Host`. Colors and role derive from the theme + variant. A
 * `loading` state (which the native primitives don't express) falls back to a
 * themed view spinner so the interface matches the web implementation.
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

  // Loading isn't expressible on the native button — render a themed view that
  // mirrors the web look so the busy state is consistent cross-platform.
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
    // Compose `Button` takes `onClick` / `enabled` / `colors` and text children.
    return (
      <Host style={hostStyle} matchContents>
        <ComposeButton
          enabled={!blocked}
          colors={{ containerColor: c.bg, contentColor: c.text }}
          onClick={onPress}
        >
          {title}
        </ComposeButton>
      </Host>
    );
  }

  // SwiftUI `Button`: text via `label`, destructive styling via `role`, and all
  // other styling through `modifiers` (there is no `variant`/`color`/`disabled`
  // prop). Ghost buttons tint with the accent; the rest tint with their bg.
  return (
    <Host style={hostStyle} matchContents>
      <SwiftUIButton
        label={title}
        role={variant === 'danger' ? 'destructive' : undefined}
        onPress={onPress}
        modifiers={[
          buttonStyle(swiftButtonStyle(variant)),
          tint(variant === 'ghost' ? colors.accent : c.bg),
          disabledModifier(blocked),
        ]}
      />
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

import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { opacity } from '../theme';
import { useTheme } from '../use-theme';
import { buttonColors, buttonMetrics } from './Button.styles';
import type { ButtonProps } from './Button.types';
import { Txt } from './Txt';

/**
 * Web / react-native-web Button — a themed `Pressable` + `Txt`. Fully
 * functional without `@expo/ui` (which has no web renderer).
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

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height: m.height,
          paddingHorizontal: m.paddingHorizontal,
          borderRadius: m.radius,
          borderWidth: m.borderWidth,
          backgroundColor: c.bg,
          borderColor: c.border,
          opacity: blocked ? opacity.disabled : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          width: fullWidth ? '100%' : undefined,
        },
      ]}
    >
      <View style={styles.content}>
        {loading ? <ActivityIndicator size="small" color={c.text} style={styles.spinner} /> : null}
        <Txt variant={m.fontVariant} weight="semibold" color={c.text}>
          {title}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center' },
  spinner: { marginRight: 8 },
});

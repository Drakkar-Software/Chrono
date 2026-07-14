import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Screen, useTheme } from '@chrono/ui';

/** Full-screen centered spinner on the themed canvas. */
export function Loading() {
  const { colors } = useTheme();
  return (
    <Screen>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

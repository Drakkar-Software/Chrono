import { StyleSheet, View } from 'react-native';
import { Button, Txt, spacing } from '@chrono/ui';

export interface LoadMoreProps {
  /** Whether more items remain to reveal. */
  hasMore: boolean;
  /** Reveal the next page. */
  onLoadMore: () => void;
  /** Count of items still hidden (shown in the button label). */
  remaining?: number;
}

/**
 * Footer control for the `.map()`-based tab lists (projects, invoices) that
 * live inside a `StackScreen` scroll view and can't wire a FlatList
 * `onEndReached`. Reveals the next page of a {@link usePagination} window and
 * disappears once the list is fully shown.
 */
export function LoadMore({ hasMore, onLoadMore, remaining }: LoadMoreProps) {
  if (!hasMore) return null;
  return (
    <View style={styles.wrap}>
      <Button
        title={remaining && remaining > 0 ? `Load more (${remaining})` : 'Load more'}
        variant="secondary"
        size="sm"
        onPress={onLoadMore}
      />
    </View>
  );
}

export interface ListFooterSpinnerProps {
  visible: boolean;
  label?: string;
}

/** A muted "loading more" caption for FlatList `ListFooterComponent`. */
export function ListFooterSpinner({ visible, label = 'Loading more…' }: ListFooterSpinnerProps) {
  if (!visible) return null;
  return (
    <View style={styles.wrap}>
      <Txt variant="caption" tone="textMuted" center>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.md },
});

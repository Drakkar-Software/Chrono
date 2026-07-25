import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { IconButton, Txt, borders, radii, spacing, useTheme } from '@chrono/ui';

export interface HeaderOverflowMenuItem {
  label: string;
  onPress: () => void;
  /** Danger-styled label (e.g. destructive actions). */
  destructive?: boolean;
}

export interface HeaderOverflowMenuProps {
  items: HeaderOverflowMenuItem[];
  accessibilityLabel: string;
}

/**
 * Ellipsis trigger + lightweight action sheet for stack-header overflow menus.
 * Keeps menu open/close state leaf-local so the parent screen stays quiet.
 */
export function HeaderOverflowMenu({ items, accessibilityLabel }: HeaderOverflowMenuProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <>
      <IconButton
        name="ellipsis-horizontal"
        onPress={() => setOpen(true)}
        accessibilityLabel={accessibilityLabel}
      />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            {items.map((item, index) => (
              <Pressable
                key={item.label}
                onPress={() => {
                  setOpen(false);
                  item.onPress();
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.item,
                  index > 0 && { borderTopWidth: borders.hairline, borderTopColor: colors.border },
                  { backgroundColor: pressed ? colors.pressed : 'transparent' },
                ]}
              >
                <Txt variant="bodyMedium" tone={item.destructive ? 'danger' : 'text'}>
                  {item.label}
                </Txt>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.lg,
    borderWidth: borders.thin,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  item: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
});

import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  BrandMark,
  Txt,
  borders,
  controlHeight,
  radii,
  shadows,
  spacing,
  useTheme,
} from '@chrono/ui';
import { companyName } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';

/** Viewport rect of the trigger, measured when the menu opens. */
type Anchor = { x: number; y: number; width: number; height: number };

/** Brand-mark edge length — unchanged from the static block this replaces. */
const MARK_SIZE = 36;
/** Floor for the menu width, so a long name still gets room past the 224px rail. */
const MENU_MIN_WIDTH = 264;
const MONOGRAM_SIZE = 28;

/** First letter of a company's display name, for the monogram tile. */
function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '—';
}

/**
 * The desktop rail's top block, doubling as the company switcher.
 *
 * Belong to a single company and this is the plain brand row it has always been
 * — no affordance for a choice that doesn't exist. Belong to more than one and
 * the same row becomes the trigger for a menu of them, so switching no longer
 * means a detour through Settings.
 *
 * The menu rides in a `Modal` — the only overlay mechanism in the app — which
 * react-native-web portals into the document body at `position: fixed`. That
 * makes the modal's coordinate space the viewport, the same space
 * `measureInWindow` reports in, so the trigger's rect anchors the menu directly
 * with no parent-offset math. `Modal` also brings Escape-to-close and a focus
 * trap for free.
 */
export function CompanySwitcher() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const { company, companyId, companies, setCompanyId } = useActiveCompany();

  const triggerRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const isOpen = anchor !== null;

  const open = useCallback(() => {
    triggerRef.current?.measureInWindow((x, y, width, height) =>
      setAnchor({ x, y, width, height }),
    );
  }, []);

  const close = useCallback(() => setAnchor(null), []);

  const select = useCallback(
    (id: string) => {
      setAnchor(null);
      if (id === companyId) return;
      setCompanyId(id);
      // Detail routes resolve their record by id while reading the *active*
      // company for role and currency — staying on /project/<id> through a
      // switch would show the old company's project judged by the new
      // company's role. Land on a company-scoped screen instead.
      router.replace('/home');
    },
    [companyId, router, setCompanyId],
  );

  const brand = (
    <>
      <BrandMark size={MARK_SIZE} shadow={false} />
      <View style={styles.brandText}>
        <Txt variant="heading" weight="bold" numberOfLines={1}>
          Chrono
        </Txt>
        {company ? (
          <Txt variant="caption" tone="textMuted" numberOfLines={1}>
            {companyName(company)}
          </Txt>
        ) : null}
      </View>
    </>
  );

  // One company — or none, including the initial load — leaves nothing to switch.
  if (companies.length < 2) return <View style={styles.brand}>{brand}</View>;

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={t('tabs.nav.switchCompany')}
        accessibilityState={{ expanded: isOpen }}
        style={({ pressed }) => [
          styles.brand,
          styles.trigger,
          { backgroundColor: isOpen || pressed ? colors.hover : 'transparent' },
        ]}
      >
        {brand}
        <Ionicons
          name="chevron-expand"
          size={18}
          color={isOpen ? colors.accent : colors.textMuted}
        />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={close}>
        {/* Bare dismiss target: an anchored menu takes no scrim, unlike the
            centred Picker sheet and the bottom action sheets. */}
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable
            accessibilityRole="menu"
            accessibilityLabel={t('tabs.nav.switchCompany')}
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.menu,
              shadows.md,
              {
                left: anchor?.x ?? 0,
                top: (anchor?.y ?? 0) + (anchor?.height ?? 0) + spacing.xs,
                width: Math.max(anchor?.width ?? 0, MENU_MIN_WIDTH),
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
              },
            ]}
          >
            <ScrollView contentContainerStyle={styles.list}>
              {companies.map((c) => {
                const name = companyName(c);
                const active = c.id === companyId;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => select(c.id)}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: active
                          ? colors.accentBg
                          : pressed
                            ? colors.pressed
                            : 'transparent',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.monogram,
                        { backgroundColor: active ? colors.accentBg : colors.hover },
                      ]}
                    >
                      <Txt variant="label" mono tone={active ? 'accent' : 'textMuted'}>
                        {initial(name)}
                      </Txt>
                    </View>
                    <View style={styles.optionText}>
                      <Txt
                        variant="bodyMedium"
                        tone={active ? 'accent' : 'text'}
                        numberOfLines={1}
                      >
                        {name}
                      </Txt>
                      <Txt variant="micro" tone="textMuted" uppercase numberOfLines={1}>
                        {t(`role.${c.role}`)}
                      </Txt>
                    </View>
                    {active ? (
                      <Ionicons name="checkmark" size={18} color={colors.accent} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  brandText: { flex: 1, minWidth: 0, gap: 0 },
  // The press pill needs breathing room the static row doesn't have; the
  // negative margin hands it straight back, so the brand block contributes the
  // same height to the rail whether or not it is a switcher.
  trigger: {
    paddingVertical: spacing.xs,
    marginVertical: -spacing.xs,
    borderRadius: radii.md,
  },
  backdrop: { flex: 1 },
  menu: {
    position: 'absolute',
    maxHeight: '60%',
    borderWidth: borders.thin,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  list: { paddingVertical: spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: controlHeight.md,
  },
  monogram: {
    width: MONOGRAM_SIZE,
    height: MONOGRAM_SIZE,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, minWidth: 0, gap: 0 },
});

import { StyleSheet, View } from "react-native";
import {
  Badge,
  Txt,
  borders,
  radii,
  shadows,
  spacing,
  useTheme,
  type BadgeStatus,
} from "@chrono/ui";
import { useT } from "@/lib/i18n";

interface Row {
  project: string;
  client: string;
  hours: string;
  amount: string;
  status: BadgeStatus;
  statusKey: string;
}

const ROWS: Row[] = [
  {
    project: "Design sprint",
    client: "Acme Studio",
    hours: "12.5h",
    amount: "€1,875",
    status: "accent",
    statusKey: "landing.ledger.logged",
  },
  {
    project: "Backend rebuild",
    client: "Nord Freelance",
    hours: "8.0h",
    amount: "€960",
    status: "warning",
    statusKey: "landing.ledger.approved",
  },
  {
    project: "Brand identity",
    client: "Atelier K",
    hours: "20.0h",
    amount: "€3,400",
    status: "info",
    statusKey: "landing.ledger.invoiced",
  },
  {
    project: "Platform ops",
    client: "Studio Volt",
    hours: "15.5h",
    amount: "€2,325",
    status: "success",
    statusKey: "landing.ledger.settled",
  },
];

/**
 * The hero's signature visual: a stylized timesheet ledger showing one row per
 * workflow stage (logged → approved → invoiced → settled) — a literal,
 * at-a-glance demo of what Chrono does, in place of a generic product screenshot.
 */
export function LedgerCard() {
  const t = useT();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.lg,
          ...shadows.lg,
        },
      ]}
    >
      <View
        style={[styles.perforation, { borderTopColor: colors.borderStrong }]}
      />

      <View style={styles.header}>
        <Txt
          variant="micro"
          mono
          uppercase
          tone="textFaint"
          style={styles.headerLabel}
        >
          {t("landing.ledger.title")}
        </Txt>
        <View style={styles.liveDot}>
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
          <Txt variant="micro" mono uppercase tone="textFaint">
            {t("landing.ledger.live")}
          </Txt>
        </View>
      </View>

      <View style={[styles.rows, { borderColor: colors.border }]}>
        {ROWS.map((r, i) => (
          <View
            key={r.project}
            style={[
              styles.row,
              i > 0 && {
                borderTopColor: colors.border,
                borderTopWidth: borders.hairline,
              },
            ]}
          >
            <View style={styles.rowMain}>
              <Txt variant="bodyMedium" weight="semibold" numberOfLines={1}>
                {r.project}
              </Txt>
              <Txt variant="caption" mono tone="textMuted" numberOfLines={1}>
                {r.client} · {r.hours}
              </Txt>
            </View>
            <View style={styles.rowEnd}>
              <Badge label={t(r.statusKey)} status={r.status} />
              <Txt
                variant="bodyMedium"
                mono
                weight="semibold"
                tabularNums
                style={styles.rowAmount}
              >
                {r.amount}
              </Txt>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.total, { borderTopColor: colors.borderStrong }]}>
        <Txt variant="caption" tone="textMuted">
          {t("landing.ledger.recognized")}
        </Txt>
        <Txt variant="title" mono weight="bold" tone="accent" tabularNums>
          €8,560
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 440,
    borderWidth: borders.thin,
    overflow: "hidden",
  },
  perforation: {
    borderTopWidth: 2,
    borderStyle: "dashed",
    marginHorizontal: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerLabel: { letterSpacing: 1.2 },
  liveDot: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  dot: { width: 6, height: 6, borderRadius: 3 },
  rows: {},
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowEnd: { alignItems: "flex-end", gap: spacing.xs, flexShrink: 0 },
  rowAmount: { textAlign: "right" },
  total: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: borders.thin,
  },
});

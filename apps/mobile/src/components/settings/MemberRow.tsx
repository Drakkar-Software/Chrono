import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Badge,
  Button,
  Picker,
  TextField,
  Txt,
  borders,
  spacing,
  useResponsive,
  useTheme,
} from '@chrono/ui';
import { DEFAULT_WORKING_WEEKDAYS, displayName } from '@chrono/sdk';
import type { AppRole, CompanyMemberWithProfile } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { WeekdayToggle } from './WeekdayToggle';
import { RowRemoveTrailing } from '@/components/projects/RowRemoveTrailing';

export interface MemberRowProps {
  member: CompanyMemberWithProfile;
  canEdit: boolean;
  /** Only admins may grant/keep the admin role — hide the option otherwise. */
  canGrantAdmin?: boolean;
  onRoleChange: (role: AppRole) => void;
  /** Weekly capacity (days/week), used for utilization reporting. */
  onCapacityChange?: (weeklyCapacityDays: number) => void;
  /** The company's default working weekdays, shown when this member has no override. */
  companyDefaultWeekdays?: number[];
  /** Set (or clear, with null) this member's personal working-weekdays override. */
  onWorkingWeekdaysChange?: (weekdays: number[] | null) => void;
  /** Rem partner flag for product-pool / license splits. */
  onRemPartnerChange?: (remPartner: boolean) => void;
  /** License recipient flag (exactly two company-wide for 50/50 splits). */
  onRemLicenseRecipientChange?: (remLicenseRecipient: boolean) => void;
  /** Optional per-member max share % (0–100). */
  onRemMaxPercentChange?: (maxPercent: number | null) => void;
  /** Soft-remove this member from the company (managers; admins for admins). */
  onRemove?: () => void;
  removing?: boolean;
  /** Hide the bottom ledger rule on the last roster row. */
  isLast?: boolean;
}

/** A company member dossier: identity strip, then optional schedule / rem fields. */
export function MemberRow({
  member,
  canEdit,
  canGrantAdmin = false,
  onRoleChange,
  onCapacityChange,
  companyDefaultWeekdays = DEFAULT_WORKING_WEEKDAYS,
  onWorkingWeekdaysChange,
  onRemPartnerChange,
  onRemLicenseRecipientChange,
  onRemMaxPercentChange,
  onRemove,
  removing = false,
  isLast = false,
}: MemberRowProps) {
  const t = useT();
  const { colors } = useTheme();
  const { isWide } = useResponsive();
  const [capacity, setCapacity] = useState(String(member.weekly_capacity_days));
  const [remMax, setRemMax] = useState(
    member.rem_max_percent != null ? String(member.rem_max_percent) : '',
  );
  const baseRoleOptions = [
    { label: t('role.freelancer'), value: 'freelancer' },
    { label: t('role.manager'), value: 'manager' },
  ];
  const adminOption = { label: t('role.admin'), value: 'admin' };
  // Show "Admin" only to admins; keep it visible if the member already is one.
  const options =
    canGrantAdmin || member.role === 'admin' ? [...baseRoleOptions, adminOption] : baseRoleOptions;

  const onCapacityText = (next: string) => {
    setCapacity(next);
    const parsed = parseFloat(next.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 7) {
      onCapacityChange?.(parsed);
    }
  };

  const hasOverride = member.working_weekdays != null;
  const showSchedule = canEdit && (!!onCapacityChange || !!onWorkingWeekdaysChange);
  const showRem = canEdit && (!!onRemPartnerChange || !!onRemLicenseRecipientChange);

  return (
    <View
      style={[
        styles.wrap,
        !isLast
          ? {
              borderBottomColor: colors.ledgerRule,
              borderBottomWidth: borders.hairline,
            }
          : null,
      ]}
    >
      <View style={styles.identity}>
        <View style={styles.identityText}>
          <Txt variant="bodyMedium" numberOfLines={1}>
            {displayName(member.profile)}
          </Txt>
          {!canEdit ? (
            <Txt variant="caption" tone="textMuted" numberOfLines={1}>
              {t('compb.capacity.daysPerWeek')}: {member.weekly_capacity_days}
            </Txt>
          ) : null}
        </View>
        {canEdit ? (
          <View style={styles.identityActions}>
            <View style={styles.roleControl}>
              <Picker
                label={t('compb.invites.roleLabel')}
                value={member.role}
                onValueChange={(v) => onRoleChange(v as AppRole)}
                options={options}
              />
            </View>
            {onRemove ? (
              <View style={styles.removeControl}>
                <RowRemoveTrailing
                  onRemove={onRemove}
                  removing={removing}
                  label={displayName(member.profile)}
                  actionLabel={t('tabs.settings.revokeMember')}
                />
              </View>
            ) : null}
          </View>
        ) : (
          <Badge label={t('role.' + member.role)} status="accent" />
        )}
      </View>

      {showSchedule ? (
        <View style={styles.section}>
          <Txt variant="caption" tone="textMuted" style={styles.sectionLabel}>
            {t('tabs.settings.memberSchedule')}
          </Txt>
          <View style={[styles.fields, isWide && styles.fieldsWide]}>
            {onCapacityChange ? (
              <View style={styles.fieldGrow}>
                <TextField
                  label={t('compb.capacity.daysPerWeek')}
                  value={capacity}
                  onChangeText={onCapacityText}
                  keyboardType="decimal-pad"
                />
              </View>
            ) : null}
            {onWorkingWeekdaysChange ? (
              <View style={styles.weekdays}>
                <Txt variant="caption" tone="textMuted">
                  {hasOverride
                    ? t('tabs.settings.memberWorkingDaysOverride')
                    : t('tabs.settings.inheritCompanyDefault')}
                </Txt>
                <WeekdayToggle
                  value={member.working_weekdays ?? companyDefaultWeekdays}
                  onChange={onWorkingWeekdaysChange}
                />
                {hasOverride ? (
                  <Button
                    title={t('tabs.settings.resetToDefault')}
                    size="sm"
                    variant="ghost"
                    onPress={() => onWorkingWeekdaysChange(null)}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {showRem ? (
        <View style={styles.section}>
          <Txt variant="caption" tone="textMuted" style={styles.sectionLabel}>
            {t('rem.settings.section')}
          </Txt>
          <View style={[styles.fields, isWide && styles.fieldsWide]}>
            {onRemPartnerChange ? (
              <View style={styles.fieldGrow}>
                <Picker
                  label={t('rem.member.partner')}
                  value={member.rem_partner ? 'yes' : 'no'}
                  onValueChange={(v) => onRemPartnerChange(v === 'yes')}
                  options={[
                    { label: t('rem.member.yes'), value: 'yes' },
                    { label: t('rem.member.no'), value: 'no' },
                  ]}
                />
              </View>
            ) : null}
            {onRemLicenseRecipientChange ? (
              <View style={styles.fieldGrow}>
                <Picker
                  label={t('rem.member.licenseRecipient')}
                  value={member.rem_license_recipient ? 'yes' : 'no'}
                  onValueChange={(v) => onRemLicenseRecipientChange(v === 'yes')}
                  options={[
                    { label: t('rem.member.yes'), value: 'yes' },
                    { label: t('rem.member.no'), value: 'no' },
                  ]}
                />
              </View>
            ) : null}
            {onRemMaxPercentChange ? (
              <View style={styles.fieldGrow}>
                <TextField
                  label={t('rem.member.maxPercent')}
                  value={remMax}
                  onChangeText={(next) => {
                    setRemMax(next);
                    if (next.trim() === '') {
                      onRemMaxPercentChange(null);
                      return;
                    }
                    const n = Number(next.replace(',', '.'));
                    if (Number.isFinite(n) && n >= 0 && n <= 100) onRemMaxPercentChange(n);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="75"
                />
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  identityText: { flex: 1, gap: spacing.xs, minWidth: 0 },
  identityActions: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    flexShrink: 0,
  },
  roleControl: { minWidth: 160, maxWidth: 200 },
  removeControl: { paddingBottom: spacing.xs },
  section: { gap: spacing.sm },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fields: { gap: spacing.md },
  fieldsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  fieldGrow: { flex: 1, minWidth: 140 },
  weekdays: { flex: 1, gap: spacing.xs, minWidth: 220 },
});

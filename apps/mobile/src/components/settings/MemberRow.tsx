import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge, Picker, TextField, Txt, spacing } from '@chrono/ui';
import { displayName } from '@chrono/sdk';
import type { AppRole, CompanyMemberWithProfile } from '@chrono/sdk';

import { useT } from '@/lib/i18n';

export interface MemberRowProps {
  member: CompanyMemberWithProfile;
  canEdit: boolean;
  /** Only admins may grant/keep the admin role — hide the option otherwise. */
  canGrantAdmin?: boolean;
  onRoleChange: (role: AppRole) => void;
  /** Weekly capacity (days/week), used for utilization reporting. */
  onCapacityChange?: (weeklyCapacityDays: number) => void;
}

/** A company member: name + role, with an inline role Picker + capacity field for managers. */
export function MemberRow({ member, canEdit, canGrantAdmin = false, onRoleChange, onCapacityChange }: MemberRowProps) {
  const t = useT();
  const [capacity, setCapacity] = useState(String(member.weekly_capacity_days));
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

  return (
    <View style={styles.row}>
      <Txt variant="bodyMedium" numberOfLines={1} style={styles.name}>
        {displayName(member.profile)}
      </Txt>
      {canEdit ? (
        <View style={styles.capacity}>
          <TextField
            label={t('compb.capacity.daysPerWeek')}
            value={capacity}
            onChangeText={onCapacityText}
            keyboardType="decimal-pad"
          />
        </View>
      ) : null}
      {canEdit ? (
        <View style={styles.control}>
          <Picker
            value={member.role}
            onValueChange={(v) => onRoleChange(v as AppRole)}
            options={options}
          />
        </View>
      ) : (
        <Badge label={t('role.' + member.role)} status="accent" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 48,
  },
  name: { flex: 1 },
  control: { minWidth: 150 },
  capacity: { width: 90 },
});

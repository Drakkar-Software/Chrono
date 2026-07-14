import { StyleSheet, View } from 'react-native';
import { Badge, Picker, Txt, spacing } from '@chrono/ui';
import { displayName, roleLabel } from '@chrono/sdk';
import type { AppRole, CompanyMemberWithProfile } from '@chrono/sdk';

const BASE_ROLE_OPTIONS = [
  { label: 'Freelancer', value: 'freelancer' },
  { label: 'Manager', value: 'manager' },
];
const ADMIN_OPTION = { label: 'Admin', value: 'admin' };

export interface MemberRowProps {
  member: CompanyMemberWithProfile;
  canEdit: boolean;
  /** Only admins may grant/keep the admin role — hide the option otherwise. */
  canGrantAdmin?: boolean;
  onRoleChange: (role: AppRole) => void;
}

/** A company member: name + role, with an inline role Picker for managers. */
export function MemberRow({ member, canEdit, canGrantAdmin = false, onRoleChange }: MemberRowProps) {
  // Show "Admin" only to admins; keep it visible if the member already is one.
  const options =
    canGrantAdmin || member.role === 'admin' ? [...BASE_ROLE_OPTIONS, ADMIN_OPTION] : BASE_ROLE_OPTIONS;
  return (
    <View style={styles.row}>
      <Txt variant="bodyMedium" numberOfLines={1} style={styles.name}>
        {displayName(member.profile)}
      </Txt>
      {canEdit ? (
        <View style={styles.control}>
          <Picker
            value={member.role}
            onValueChange={(v) => onRoleChange(v as AppRole)}
            options={options}
          />
        </View>
      ) : (
        <Badge label={roleLabel(member.role)} status="accent" />
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
});

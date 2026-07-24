import { StyleSheet, View } from 'react-native';
import { REM_POLICIES, type RemPolicy } from '@chrono/sdk';
import { Txt, spacing } from '@chrono/ui';
import { useT } from '@/lib/i18n';

export interface RemPolicyHelpProps {
  /** Currently selected rem policy — shown in bold. */
  value: RemPolicy;
}

/** Short descriptions of each rem policy; the active one is bold. */
export function RemPolicyHelp({ value }: RemPolicyHelpProps) {
  const t = useT();
  return (
    <View style={styles.wrap}>
      {REM_POLICIES.map((policy) => {
        const active = policy === value;
        return (
          <Txt
            key={policy}
            variant="caption"
            weight={active ? 'bold' : 'regular'}
            tone={active ? 'text' : 'textMuted'}
          >
            {t(`rem.policy.${policy}`)} — {t(`rem.policy.desc.${policy}`)}
          </Txt>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
});

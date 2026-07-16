import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { spacing } from '@chrono/ui';

import { useActiveCompany } from '@/lib/active-company-context';
import { useChronoPro } from '@/lib/hooks/use-subscription';
import { PaywallBody } from '@/components/billing/PaywallBody';

/**
 * Modal route (see `(app)/_layout.tsx`'s `presentation: 'modal'` for
 * `"paywall"`) — reachable from anywhere in the app via `router.push('/paywall')`
 * without a dedicated global sheet Provider/Context.
 */
export default function PaywallScreen() {
  const router = useRouter();
  const { companyId, role } = useActiveCompany();
  const { sub, seatCount, trialDaysLeft } = useChronoPro(companyId ?? undefined);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <PaywallBody
        sub={sub}
        seatCount={seatCount}
        isAdmin={role === 'admin'}
        trialDaysLeft={trialDaysLeft}
        onDone={() => router.back()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, gap: spacing.lg },
});

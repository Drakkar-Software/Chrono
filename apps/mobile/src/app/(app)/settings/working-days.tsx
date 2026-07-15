import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { StackScreen, TitledCard, spacing } from '@chrono/ui';
import { canManage } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { WorkingDaysCard } from '@/components/settings/WorkingDaysCard';

export default function WorkingDaysSettingsScreen() {
  const t = useT();
  const router = useRouter();
  const { company, role } = useActiveCompany();

  if (!canManage(role) || !company) return <Redirect href="/settings" />;

  return (
    <StackScreen title={t('tabs.settings.workingDaysAndHolidays')} onBack={() => router.back()}>
      <View style={styles.wrap}>
        <TitledCard title={t('tabs.settings.workingDaysAndHolidays')}>
          <WorkingDaysCard company={company} />
        </TitledCard>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
});

import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Row, StackScreen, TitledCard, spacing } from '@chrono/ui';
import { companyName } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { EditCompanyForm } from '@/components/settings/EditCompanyForm';

export default function EnterpriseSettingsScreen() {
  const t = useT();
  const router = useRouter();
  const { company, role, refresh } = useActiveCompany();
  const isAdmin = role === 'admin';

  if (!company) return <Redirect href="/settings" />;

  return (
    <StackScreen title={t('tabs.settings.company')} onBack={() => router.back()}>
      <View style={styles.wrap}>
        <TitledCard title={t('tabs.settings.company')}>
          {isAdmin ? (
            <EditCompanyForm company={company} onSaved={refresh} />
          ) : (
            <Row label={t('tabs.settings.name')} value={companyName(company)} />
          )}
        </TitledCard>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
});

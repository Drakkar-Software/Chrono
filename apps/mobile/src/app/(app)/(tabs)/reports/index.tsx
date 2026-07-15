import { Redirect, useRouter } from 'expo-router';
import { Badge, Card, ListItem, StackScreen } from '@chrono/ui';
import { canManage } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { usePendingApprovals } from '@/lib/hooks/use-approvals';
import { usePendingExpenses } from '@/lib/hooks/use-project-expenses';

export default function ReportsScreen() {
  const t = useT();
  const router = useRouter();
  const { companyId, role } = useActiveCompany();

  const { data: pending } = usePendingApprovals(companyId ?? undefined);
  const { data: pendingExpenses } = usePendingExpenses(companyId ?? undefined);
  const reviewCount = (pending ?? []).length + (pendingExpenses ?? []).length;

  // Manager/admin only. Guard the direct-URL case (the tab is already hidden for
  // freelancers) — all hooks above run so hook order stays stable.
  if (!canManage(role)) return <Redirect href="/(app)/(tabs)/home" />;

  return (
    <StackScreen title={t('tabs.nav.reports')}>
      <Card padding="none">
        <ListItem
          title={t('tabs.reports.approvals')}
          subtitle={t('tabs.reports.approvalsNavHint')}
          trailing={reviewCount > 0 ? <Badge label={String(reviewCount)} status="warning" /> : undefined}
          onPress={() => router.push('/reports/approvals')}
        />
        <ListItem
          title={t('tabs.reports.analytics')}
          subtitle={t('tabs.reports.analyticsNavHint')}
          onPress={() => router.push('/reports/analytics')}
        />
        <ListItem
          title={t('tabs.reports.projectPnl')}
          subtitle={t('tabs.reports.profitabilityNavHint')}
          onPress={() => router.push('/reports/profitability')}
        />
        <ListItem
          title={t('tabs.reports.auditLog')}
          onPress={() => router.push('/audit')}
          divider={false}
        />
      </Card>
    </StackScreen>
  );
}

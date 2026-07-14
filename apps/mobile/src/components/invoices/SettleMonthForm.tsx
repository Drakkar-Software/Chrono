import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Picker, Txt, spacing } from '@chrono/ui';
import type { Project } from '@chrono/sdk';
import { FieldRow } from '@/components/common/FieldRow';
import { useT } from '@/lib/i18n';

export interface SettleMonthFormProps {
  projects: Project[];
  onSettle: (projectId: string, month: string) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function monthOptions(count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const ym = d.toISOString().slice(0, 7);
    return { label: ym, value: `${ym}-01` };
  });
}

/** Manager action: recognize revenue + settle a project's month (FIFO). */
export function SettleMonthForm({ projects, onSettle, onCancel, isSubmitting = false }: SettleMonthFormProps) {
  const t = useT();
  const months = useMemo(() => monthOptions(), []);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [month, setMonth] = useState(months[0]?.value ?? '');

  return (
    <Card padding="lg" style={styles.card}>
      <Txt variant="heading">{t('comp.invoice.settleMonth')}</Txt>
      <FieldRow>
        <Picker
          label={t('comp.field.project')}
          value={projectId}
          onValueChange={setProjectId}
          options={projects.map((p) => ({ label: p.name, value: p.id }))}
          placeholder={t('comp.field.selectProject')}
        />
        <Picker label={t('comp.invoice.month')} value={month} onValueChange={setMonth} options={months} />
      </FieldRow>
      <Button
        title={t('comp.invoice.settleMonthBtn')}
        onPress={() => projectId && month && onSettle(projectId, month)}
        loading={isSubmitting}
        disabled={projects.length === 0}
        fullWidth
      />
      <Button title={t('common.cancel')} variant="ghost" onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});

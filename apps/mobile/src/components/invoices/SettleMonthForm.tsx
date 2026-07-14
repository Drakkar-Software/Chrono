import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Picker, Txt, spacing } from '@chrono/ui';
import type { Project } from '@chrono/sdk';

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
  const months = useMemo(() => monthOptions(), []);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [month, setMonth] = useState(months[0]?.value ?? '');

  return (
    <Card padding="lg" style={styles.card}>
      <Txt variant="heading">Settle a month</Txt>
      <Picker
        label="Project"
        value={projectId}
        onValueChange={setProjectId}
        options={projects.map((p) => ({ label: p.name, value: p.id }))}
        placeholder="Select a project"
      />
      <Picker label="Month" value={month} onValueChange={setMonth} options={months} />
      <Button
        title="Settle month"
        onPress={() => projectId && month && onSettle(projectId, month)}
        loading={isSubmitting}
        disabled={projects.length === 0}
        fullWidth
      />
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});

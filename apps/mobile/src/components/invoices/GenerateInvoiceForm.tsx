import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Picker, Txt, spacing } from '@chrono/ui';
import { effectiveTjm } from '@chrono/sdk';
import type { Project } from '@chrono/sdk';
import { useProjectMembers } from '@/lib/hooks/use-project-members';
import { FieldRow } from '@/components/common/FieldRow';

export interface GenerateInvoiceParams {
  projectId: string;
  month: string;
  tjmCents: number;
  hoursPerDay: number;
}

export interface GenerateInvoiceFormProps {
  projects: Project[];
  freelancerId: string;
  onGenerate: (params: GenerateInvoiceParams) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

/** Build the last N month options as { label: 'YYYY-MM', value: 'YYYY-MM-01' }. */
function monthOptions(count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const ym = d.toISOString().slice(0, 7);
    return { label: ym, value: `${ym}-01` };
  });
}

/** Pick a project + month; resolves the freelancer's TJM and hours/day. */
export function GenerateInvoiceForm({
  projects,
  freelancerId,
  onGenerate,
  onCancel,
  isSubmitting = false,
}: GenerateInvoiceFormProps) {
  const months = useMemo(() => monthOptions(), []);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [month, setMonth] = useState(months[0]?.value ?? '');

  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);
  const { data: members } = useProjectMembers(projectId || undefined);
  const myMember = useMemo(
    () => (members ?? []).find((m) => m.user_id === freelancerId),
    [members, freelancerId],
  );

  const submit = () => {
    if (!project || !month) return;
    onGenerate({
      projectId: project.id,
      month,
      tjmCents: effectiveTjm(myMember, project),
      hoursPerDay: project.hours_per_day,
    });
  };

  return (
    <Card padding="lg" style={styles.card}>
      <Txt variant="heading">Generate invoice</Txt>
      <FieldRow>
        <Picker
          label="Project"
          value={projectId}
          onValueChange={setProjectId}
          options={projects.map((p) => ({ label: p.name, value: p.id }))}
          placeholder="Select a project"
        />
        <Picker label="Month" value={month} onValueChange={setMonth} options={months} />
      </FieldRow>
      <Button
        title="Generate & submit"
        onPress={submit}
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

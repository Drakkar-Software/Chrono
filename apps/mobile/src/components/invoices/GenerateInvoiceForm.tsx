import { useMemo, useState } from 'react';
import { Picker, TitledCard } from '@chrono/ui';
import { effectiveTjm } from '@chrono/sdk';
import type { Project } from '@chrono/sdk';
import { useProjectMembers } from '@/lib/hooks/use-project-members';
import { FieldRow } from '@/components/common/FieldRow';
import { FormActions } from '@/components/common/FormActions';
import { useT } from '@/lib/i18n';

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
  const t = useT();
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
    <TitledCard title={t('comp.invoice.generate')}>
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
      <FormActions
        submitLabel={t('comp.invoice.generateSubmit')}
        onSubmit={submit}
        busy={isSubmitting}
        submitDisabled={projects.length === 0}
        onCancel={onCancel}
      />
    </TitledCard>
  );
}

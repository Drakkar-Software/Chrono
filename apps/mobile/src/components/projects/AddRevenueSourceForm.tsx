import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Picker, TextField, Txt, spacing } from '@chrono/ui';
import { revenueSourceLabel } from '@chrono/sdk';
import type { Json, RevenueSourceType } from '@chrono/sdk';
import { useT } from '@/lib/i18n';

export interface AddRevenueSourceValues {
  name: string;
  type: RevenueSourceType;
  content: Json;
}

export interface AddRevenueSourceFormProps {
  onAdd: (values: AddRevenueSourceValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const TYPE_OPTIONS = (['time_based', 'recurring', 'self_billing'] as RevenueSourceType[]).map((t) => ({
  label: revenueSourceLabel(t),
  value: t,
}));

function toCents(input: string): number {
  const parsed = parseFloat(input.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/** Add a revenue source; the amount field's meaning follows the chosen type. */
export function AddRevenueSourceForm({ onAdd, onCancel, isSubmitting = false }: AddRevenueSourceFormProps) {
  const t = useT();
  const [name, setName] = useState('');
  const [type, setType] = useState<RevenueSourceType>('time_based');
  const [amount, setAmount] = useState('');
  const [markup, setMarkup] = useState('');
  const [error, setError] = useState<string | undefined>();

  const amountLabel = type === 'recurring' ? t('comp.revsource.monthlyAmount') : t('comp.revsource.clientDayRate');

  const submit = () => {
    if (!name.trim()) {
      setError(t('comp.revsource.errName'));
      return;
    }
    const cents = toCents(amount);
    if (cents < 0) {
      setError(t('comp.revsource.errNegative', { label: amountLabel }));
      return;
    }
    let content: Json;
    if (type === 'recurring') {
      content = { monthly_amount_cents: cents };
    } else if (type === 'self_billing') {
      const markupPct = Number.isFinite(parseFloat(markup.replace(',', '.')))
        ? parseFloat(markup.replace(',', '.'))
        : 0;
      if (markupPct < -100) {
        setError(t('comp.revsource.errMarkupMin'));
        return;
      }
      content = {
        client_tjm_cents: cents,
        markup_pct: markupPct,
      };
    } else {
      content = { client_tjm_cents: cents };
    }
    setError(undefined);
    onAdd({ name: name.trim(), type, content });
  };

  return (
    <Card padding="lg" style={styles.card}>
      <Txt variant="heading">{t('comp.revsource.title')}</Txt>
      <TextField label={t('comp.field.name')} value={name} onChangeText={setName} placeholder={t('comp.revsource.namePlaceholder')} />
      <Picker
        label={t('comp.revsource.type')}
        value={type}
        onValueChange={(v) => setType(v as RevenueSourceType)}
        options={TYPE_OPTIONS}
      />
      <TextField
        label={amountLabel}
        value={amount}
        onChangeText={setAmount}
        placeholder="500"
        keyboardType="decimal-pad"
      />
      {type === 'self_billing' ? (
        <TextField
          label={t('comp.revsource.markup')}
          value={markup}
          onChangeText={setMarkup}
          placeholder="0"
          keyboardType="decimal-pad"
        />
      ) : null}
      {error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : null}
      <Button title={t('comp.revsource.addSource')} onPress={submit} loading={isSubmitting} fullWidth />
      <Button title={t('common.cancel')} variant="ghost" onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});

import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Picker, TextField, Txt, spacing } from '@chrono/ui';
import { revenueSourceLabel } from '@chrono/sdk';
import type { Json, RevenueSourceType } from '@chrono/sdk';

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
  const [name, setName] = useState('');
  const [type, setType] = useState<RevenueSourceType>('time_based');
  const [amount, setAmount] = useState('');
  const [markup, setMarkup] = useState('');
  const [error, setError] = useState<string | undefined>();

  const amountLabel = type === 'recurring' ? 'Monthly amount' : 'Client day rate (TJM)';

  const submit = () => {
    if (!name.trim()) {
      setError('Enter a name');
      return;
    }
    setError(undefined);
    const cents = toCents(amount);
    let content: Json;
    if (type === 'recurring') {
      content = { monthly_amount_cents: cents };
    } else if (type === 'self_billing') {
      const markupPct = parseFloat(markup.replace(',', '.'));
      content = {
        client_tjm_cents: cents,
        markup_pct: Number.isFinite(markupPct) ? markupPct : 0,
      };
    } else {
      content = { client_tjm_cents: cents };
    }
    onAdd({ name: name.trim(), type, content });
  };

  return (
    <Card padding="lg" style={styles.card}>
      <Txt variant="heading">Add revenue source</Txt>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Monthly retainer" error={error} />
      <Picker
        label="Type"
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
          label="Markup %"
          value={markup}
          onChangeText={setMarkup}
          placeholder="0"
          keyboardType="decimal-pad"
        />
      ) : null}
      <Button title="Add source" onPress={submit} loading={isSubmitting} fullWidth />
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Picker, TextField, spacing, useResponsive } from '@chrono/ui';
import { companyCurrency, companyName } from '@chrono/sdk';
import type { CompanyMembership, Json } from '@chrono/sdk';

import { useCompanyMutations } from '@/lib/hooks/use-companies';
import { AvatarUpload } from '@/components/settings/AvatarUpload';
import { InlineError } from '@/components/common/ErrorState';

/** Currencies offered for a company. Codes drive money formatting elsewhere. */
const CURRENCY_OPTIONS = [
  { label: 'EUR — Euro', value: 'EUR' },
  { label: 'USD — US Dollar', value: 'USD' },
  { label: 'GBP — British Pound', value: 'GBP' },
  { label: 'CHF — Swiss Franc', value: 'CHF' },
  { label: 'CAD — Canadian Dollar', value: 'CAD' },
  { label: 'AUD — Australian Dollar', value: 'AUD' },
  { label: 'JPY — Japanese Yen', value: 'JPY' },
];

/** The `content` jsonb shape we read/merge — other keys are preserved on save. */
type CompanyContent = { name?: string; logo_url?: string } & Record<string, unknown>;

export interface EditCompanyFormProps {
  company: CompanyMembership;
  /** Called after a successful save (e.g. to refresh the active company). */
  onSaved: () => void | Promise<void>;
}

/** Admin-only editor for a company's name, currency and logo. */
export function EditCompanyForm({ company, onSaved }: EditCompanyFormProps) {
  const { isWide } = useResponsive();
  const { update, isPending, error } = useCompanyMutations();

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Seed the editable fields when the active company loads/changes. Legitimate
  // prop->state sync of async-loaded values (mirrors the profile-name pattern).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop->state sync of an async-loaded value
    setName(companyName(company));
    setCurrency(companyCurrency(company));
    const content = (company.content ?? {}) as CompanyContent;
    setLogoUrl(content.logo_url ?? null);
  }, [company]);

  const save = async () => {
    const content = (company.content ?? {}) as CompanyContent;
    const mergedContent: CompanyContent = {
      ...content,
      name: name.trim(),
      logo_url: logoUrl ?? undefined,
    };
    await update(company.id, { content: mergedContent as Json, currency });
    await onSaved();
  };

  return (
    <View style={styles.wrap}>
      <AvatarUpload
        imageUrl={logoUrl}
        name={name || companyName(company)}
        bucket="company-logos"
        folder={company.id}
        fileName="logo"
        label="Change logo"
        shape="rounded"
        onUploaded={setLogoUrl}
      />
      <TextField label="Company name" value={name} onChangeText={setName} placeholder="Company name" />
      <Picker
        label="Currency"
        value={currency}
        onValueChange={setCurrency}
        options={CURRENCY_OPTIONS}
      />
      {error ? (
        <InlineError error={error} describe={{ fallback: 'Could not save company settings.' }} />
      ) : null}
      <Button
        title="Save company"
        onPress={save}
        loading={isPending}
        disabled={!name.trim()}
        fullWidth={!isWide}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
});

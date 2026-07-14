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
  const [legalName, setLegalName] = useState('');
  const [address, setAddress] = useState('');
  const [vatId, setVatId] = useState('');
  const [registrationId, setRegistrationId] = useState('');
  const [vatRate, setVatRate] = useState('');

  // Seed the editable fields when the active company loads/changes. Legitimate
  // prop->state sync of async-loaded values (mirrors the profile-name pattern).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop->state sync of an async-loaded value
    setName(companyName(company));
    setCurrency(companyCurrency(company));
    const content = (company.content ?? {}) as CompanyContent;
    setLogoUrl(content.logo_url ?? null);
    setLegalName(company.legal_name ?? '');
    setAddress(company.address ?? '');
    setVatId(company.vat_id ?? '');
    setRegistrationId(company.registration_id ?? '');
    setVatRate(company.vat_rate != null ? String(company.vat_rate) : '');
  }, [company]);

  const save = async () => {
    const content = (company.content ?? {}) as CompanyContent;
    const mergedContent: CompanyContent = {
      ...content,
      name: name.trim(),
      logo_url: logoUrl ?? undefined,
    };
    const parsedVat = vatRate.trim() === '' ? null : Number(vatRate);
    await update(company.id, {
      content: mergedContent as Json,
      currency,
      legal_name: legalName.trim() || null,
      address: address.trim() || null,
      vat_id: vatId.trim() || null,
      registration_id: registrationId.trim() || null,
      vat_rate: parsedVat != null && Number.isFinite(parsedVat) ? parsedVat : null,
    });
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
      <TextField
        label="Legal name (optional)"
        value={legalName}
        onChangeText={setLegalName}
        placeholder="Registered company name"
      />
      <TextField
        label="Address (optional)"
        value={address}
        onChangeText={setAddress}
        placeholder="Billing address"
        multiline
      />
      <TextField label="VAT number (optional)" value={vatId} onChangeText={setVatId} placeholder="e.g. FR12345678901" />
      <TextField
        label="Registration ID (optional)"
        value={registrationId}
        onChangeText={setRegistrationId}
        placeholder="e.g. SIRET"
      />
      <TextField
        label="Default VAT rate % (optional)"
        value={vatRate}
        onChangeText={setVatRate}
        placeholder="e.g. 20"
        keyboardType="decimal-pad"
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

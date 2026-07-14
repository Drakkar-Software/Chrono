import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Picker, TextField, spacing, useResponsive } from '@chrono/ui';
import { companyCurrency, companyName } from '@chrono/sdk';
import type { CompanyMembership, Json } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useCompanyMutations } from '@/lib/hooks/use-companies';
import { AvatarUpload } from '@/components/settings/AvatarUpload';
import { InlineError } from '@/components/common/ErrorState';

/** The `content` jsonb shape we read/merge — other keys are preserved on save. */
type CompanyContent = { name?: string; logo_url?: string } & Record<string, unknown>;

export interface EditCompanyFormProps {
  company: CompanyMembership;
  /** Called after a successful save (e.g. to refresh the active company). */
  onSaved: () => void | Promise<void>;
}

/** Admin-only editor for a company's name, currency and logo. */
export function EditCompanyForm({ company, onSaved }: EditCompanyFormProps) {
  const t = useT();
  const { isWide } = useResponsive();
  const { update, isPending, error } = useCompanyMutations();

  // Currencies offered for a company. Codes drive money formatting elsewhere.
  const CURRENCY_OPTIONS = [
    { label: t('compb.currency.eur'), value: 'EUR' },
    { label: t('compb.currency.usd'), value: 'USD' },
    { label: t('compb.currency.gbp'), value: 'GBP' },
    { label: t('compb.currency.chf'), value: 'CHF' },
    { label: t('compb.currency.cad'), value: 'CAD' },
    { label: t('compb.currency.aud'), value: 'AUD' },
    { label: t('compb.currency.jpy'), value: 'JPY' },
  ];

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [legalName, setLegalName] = useState('');
  const [address, setAddress] = useState('');
  const [vatId, setVatId] = useState('');
  const [registrationId, setRegistrationId] = useState('');
  const [vatRate, setVatRate] = useState('');
  const [vatError, setVatError] = useState<string | undefined>();

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
    let parsedVat: number | null = null;
    if (vatRate.trim() !== '') {
      const n = Number(vatRate.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setVatError(t('compb.company.vatRateError'));
        return;
      }
      parsedVat = n;
    }
    setVatError(undefined);
    await update(company.id, {
      content: mergedContent as Json,
      currency,
      legal_name: legalName.trim() || null,
      address: address.trim() || null,
      vat_id: vatId.trim() || null,
      registration_id: registrationId.trim() || null,
      vat_rate: parsedVat,
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
        label={t('compb.company.changeLogo')}
        shape="rounded"
        onUploaded={setLogoUrl}
      />
      <TextField
        label={t('compb.company.nameLabel')}
        value={name}
        onChangeText={setName}
        placeholder={t('compb.company.nameLabel')}
      />
      <Picker
        label={t('compb.company.currencyLabel')}
        value={currency}
        onValueChange={setCurrency}
        options={CURRENCY_OPTIONS}
      />
      <TextField
        label={t('compb.company.legalNameLabel')}
        value={legalName}
        onChangeText={setLegalName}
        placeholder={t('compb.company.legalNamePlaceholder')}
      />
      <TextField
        label={t('compb.company.addressLabel')}
        value={address}
        onChangeText={setAddress}
        placeholder={t('compb.company.addressPlaceholder')}
        multiline
      />
      <TextField
        label={t('compb.company.vatNumberLabel')}
        value={vatId}
        onChangeText={setVatId}
        placeholder={t('compb.company.vatNumberPlaceholder')}
      />
      <TextField
        label={t('compb.company.registrationLabel')}
        value={registrationId}
        onChangeText={setRegistrationId}
        placeholder={t('compb.company.registrationPlaceholder')}
      />
      <TextField
        label={t('compb.company.vatRateLabel')}
        value={vatRate}
        onChangeText={setVatRate}
        placeholder={t('compb.company.vatRatePlaceholder')}
        keyboardType="decimal-pad"
        error={vatError}
      />
      {error ? (
        <InlineError error={error} describe={{ fallback: t('compb.company.saveFail') }} />
      ) : null}
      <Button
        title={t('compb.company.save')}
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

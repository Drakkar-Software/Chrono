import type { TypeVariant } from '../theme';
import type { Palette } from '../use-theme';
import { Txt } from './Txt';

export interface MoneyProps {
  /** Amount in the currency's minor units (e.g. cents). */
  cents: number;
  /** ISO 4217 currency code. Default `USD`. */
  currency?: string;
  /** BCP-47 locale for formatting. Default `en-US`. */
  locale?: string;
  /** Type-scale step. Default `bodyMedium`. */
  variant?: TypeVariant;
  /** Palette token for the text color. Default `text`. */
  tone?: keyof Palette;
}

/** Format integer minor units + currency to a localized string. */
export function formatMoney(cents: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

/**
 * Renders a monetary amount (integer minor units) as themed, tabular-figure
 * text via `Intl.NumberFormat`. Presentational — pass an already-known amount.
 */
export function Money({ cents, currency = 'USD', locale = 'en-US', variant = 'bodyMedium', tone = 'text' }: MoneyProps) {
  return (
    <Txt variant={variant} tone={tone} tabularNums>
      {formatMoney(cents, currency, locale)}
    </Txt>
  );
}

import { Platform } from 'react-native';
import {
  formatDuration,
  formatMoney,
  invoiceAmounts,
  invoiceStatusLabel,
  minutesToDays,
  vatBreakdown,
} from '@chrono/sdk';
import type { Invoice } from '@chrono/sdk';

/** A legal party rendered in the invoice's From / Bill-to blocks. */
export interface InvoiceParty {
  name: string;
  address?: string | null;
  /** VAT registration number. */
  vatId?: string | null;
  /** Company registry id (SIRET) or freelancer business id. */
  registrationId?: string | null;
}

export interface InvoiceDocInput {
  invoice: Invoice;
  projectName: string;
  /** The freelancer issuing the invoice. */
  from: InvoiceParty;
  /** The company being billed. */
  to: InvoiceParty;
  currency: string;
  /** Public company logo URL, embedded in the header when present. */
  logoUrl?: string | null;
}

/** HTML-escape a user-supplied string for safe interpolation into the document. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build a clean, printable HTML invoice document. Self-contained (inline CSS),
 * so it renders identically whether printed on web or rendered to PDF natively.
 *
 * Colors/sizes here are document styling for a standalone print artifact — not
 * app UI — so they are intentionally literal rather than theme tokens.
 */
/** Render a legal party block (name + optional address / tax ids), escaped. */
function partyBlock(heading: string, party: InvoiceParty, extra?: string): string {
  const lines: string[] = [];
  if (party.address) lines.push(`<p class="muted">${esc(party.address)}</p>`);
  if (party.vatId) lines.push(`<p class="muted">VAT: ${esc(party.vatId)}</p>`);
  if (party.registrationId) lines.push(`<p class="muted">Reg: ${esc(party.registrationId)}</p>`);
  if (extra) lines.push(extra);
  return `<div class="party"><h3>${esc(heading)}</h3><p>${esc(party.name)}</p>${lines.join('')}</div>`;
}

export function buildInvoiceHtml({
  invoice,
  projectName,
  from,
  to,
  currency,
  logoUrl,
}: InvoiceDocInput): string {
  const a = invoiceAmounts(invoice);
  const period = invoice.period_month.slice(0, 7);
  const days = minutesToDays(invoice.worked_minutes, invoice.hours_per_day);
  const money = (cents: number) => esc(formatMoney(cents, currency));

  // VAT applies to the net amount due (this period's earned + carried credit).
  const vat = vatBreakdown(a.amountDueCents, invoice.vat_rate);
  const showVat = vat.rate > 0;

  const billedRows: { label: string; value: string; strong?: boolean }[] = [
    { label: 'Worked time', value: `${esc(formatDuration(invoice.worked_minutes))} · ${days.toFixed(2)} days` },
    { label: 'Day rate (TJM)', value: money(invoice.tjm_cents) },
    { label: 'Earned', value: money(a.earnedCents) },
    { label: 'Credit brought forward', value: money(a.creditBroughtForwardCents) },
  ];
  if (showVat) {
    billedRows.push(
      { label: 'Subtotal (net)', value: money(vat.netCents), strong: true },
      { label: `VAT (${vat.rate}%)`, value: money(vat.taxCents) },
      { label: 'Total (incl. VAT)', value: money(vat.grossCents), strong: true },
    );
  } else {
    billedRows.push({ label: 'Amount due', value: money(a.amountDueCents), strong: true });
  }

  const settlementRows: { label: string; value: string; strong?: boolean }[] = [
    { label: 'Amount paid', value: money(a.amountPaidCents) },
    { label: 'Carried forward', value: money(a.creditCarriedForwardCents) },
    { label: 'Outstanding', value: money(a.outstandingCents), strong: true },
  ];

  const toRows = (rows: typeof billedRows) =>
    rows
      .map(
        (r) =>
          `<tr${r.strong ? ' class="strong"' : ''}><td class="label">${esc(r.label)}</td><td class="amount">${r.value}</td></tr>`,
      )
      .join('');

  const logo = logoUrl
    ? `<img class="logo" src="${esc(logoUrl)}" alt="${esc(to.name)}" />`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Invoice ${esc(period)} — ${esc(projectName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 40px; background: #fff; }
  .doc { max-width: 720px; margin: 0 auto; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
  .brand small { display: block; font-size: 12px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; color: #666; margin-top: 4px; }
  .period { text-align: right; font-size: 13px; color: #555; }
  .period .status { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 999px; background: #eef; color: #334; font-weight: 600; font-size: 12px; }
  .brand-wrap { display: flex; align-items: center; gap: 12px; }
  .logo { max-height: 44px; max-width: 160px; object-fit: contain; }
  .parties { display: flex; gap: 32px; margin-bottom: 28px; }
  .party { flex: 1; }
  .party h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin: 0 0 6px; }
  .party p { margin: 0 0 2px; font-size: 15px; font-weight: 600; }
  .party p.muted { font-weight: 500; color: #666; font-size: 13px; }
  .section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin: 24px 0 4px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 10px 0; border-bottom: 1px solid #eee; font-size: 14px; }
  td.label { color: #444; }
  td.amount { text-align: right; font-variant-numeric: tabular-nums; }
  tr.strong td { font-weight: 700; color: #111; }
  footer { margin-top: 32px; font-size: 12px; color: #999; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="doc">
    <header>
      <div class="brand-wrap">
        ${logo}
        <div class="brand">Chrono<small>Invoice</small></div>
      </div>
      <div class="period">
        <div>Period ${esc(period)}</div>
        <span class="status">${esc(invoiceStatusLabel(invoice.status))}</span>
      </div>
    </header>
    <div class="parties">
      ${partyBlock('From', from)}
      ${partyBlock('Bill to', to, `<p class="muted">${esc(projectName)}</p>`)}
    </div>
    <table>${toRows(billedRows)}</table>
    <div class="section-label">Settlement</div>
    <table>${toRows(settlementRows)}</table>
    <footer>Generated by Chrono · ${esc(period)}</footer>
  </div>
</body>
</html>`;
}

/**
 * Export/share an invoice document.
 *
 * Web: opens a print window on the rendered document (`window.print()`).
 * Native: renders the HTML to a PDF via `expo-print`, then shares it via
 * `expo-sharing`. Native modules are dynamically imported inside the guarded
 * branch so they never enter the web bundle.
 */
export async function exportInvoice(html: string): Promise<void> {
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (!win) {
      throw new Error('Could not open a print window. Allow pop-ups and try again.');
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    // Let the browser lay out the document before invoking the print dialog.
    win.setTimeout(() => win.print(), 300);
    return;
  }

  const Print = await import('expo-print');
  const Sharing = await import('expo-sharing');
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share invoice',
      UTI: 'com.adobe.pdf',
    });
  }
}

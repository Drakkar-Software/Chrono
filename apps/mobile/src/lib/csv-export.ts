import { Platform } from 'react-native';
import { formatDuration } from '@chrono/sdk';
import type { InvoiceWithRelations, TimeEntryWithProject } from '@chrono/sdk';

/** Quote a CSV field when it contains a comma, quote or newline. */
function cell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Join rows into a CSV document (CRLF line endings for spreadsheet apps). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

const money = (cents: number) => (cents / 100).toFixed(2);

/** Time entries → CSV. Amounts are omitted (entries carry no money themselves). */
export function timeEntriesCsv(entries: TimeEntryWithProject[]): string {
  const rows: (string | number | null | undefined)[][] = [
    ['Date', 'Project', 'Hours', 'Duration', 'Billable', 'Status', 'Tags', 'Description'],
  ];
  for (const e of entries) {
    rows.push([
      e.entry_date.slice(0, 10),
      e.project?.name ?? '',
      (e.duration_minutes / 60).toFixed(2),
      formatDuration(e.duration_minutes),
      e.billable ? 'yes' : 'no',
      e.status,
      (e.tags ?? []).join(' '),
      e.description ?? '',
    ]);
  }
  return toCsv(rows);
}

/** Invoices → CSV, one row per invoice with the money breakdown. */
export function invoicesCsv(invoices: InvoiceWithRelations[]): string {
  const rows: (string | number | null | undefined)[][] = [
    ['Number', 'Issued', 'Period', 'Project', 'Status', 'Earned', 'Due', 'Paid', 'Carried', 'VAT %'],
  ];
  for (const i of invoices) {
    rows.push([
      i.invoice_number ?? '',
      i.issued_on ?? '',
      i.period_month.slice(0, 7),
      i.project?.name ?? '',
      i.status,
      money(i.earned_cents ?? 0),
      money(i.amount_due_cents ?? 0),
      money(i.amount_paid_cents ?? 0),
      money(i.credit_carried_forward_cents ?? 0),
      i.vat_rate != null ? String(i.vat_rate) : '',
    ]);
  }
  return toCsv(rows);
}

/**
 * Save/share a CSV document. Web triggers a file download; native writes it to a
 * cache file and opens the share sheet (expo-file-system + expo-sharing, both
 * dynamically imported so they never enter the web bundle).
 */
export async function exportCsv(filename: string, content: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const FileSystem = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const file = new FileSystem.File(FileSystem.Paths.cache, filename);
  try {
    file.create({ overwrite: true });
  } catch {
    // already exists / will be overwritten by write
  }
  file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export CSV' });
  }
}

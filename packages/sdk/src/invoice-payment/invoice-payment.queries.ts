import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../schema';
import type { InvoicePayment } from './invoice-payment.entity';

type Client = SupabaseClient<Database>;

/** Manual payments recorded against an invoice, newest first. */
export async function fetchInvoicePayments(
  client: Client,
  invoiceId: string,
): Promise<InvoicePayment[]> {
  const { data, error } = await client
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .eq('deleted', false)
    .order('paid_on', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InvoicePayment[];
}

export async function recordInvoicePayment(
  client: Client,
  input: {
    invoiceId: string;
    companyId: string;
    amountCents: number;
    paidOn: string;
    method: string | null;
    note: string | null;
    recordedBy: string;
    cryptoAsset?: string | null;
    cryptoAmount?: string | null;
    cryptoTxHash?: string | null;
    cryptoWallet?: string | null;
  },
): Promise<InvoicePayment> {
  const { data, error } = await client
    .from('invoice_payments')
    .insert({
      invoice_id: input.invoiceId,
      company_id: input.companyId,
      amount_cents: input.amountCents,
      paid_on: input.paidOn,
      method: input.method,
      note: input.note,
      recorded_by: input.recordedBy,
      crypto_asset: input.cryptoAsset ?? null,
      crypto_amount: input.cryptoAmount ?? null,
      crypto_tx_hash: input.cryptoTxHash ?? null,
      crypto_wallet: input.cryptoWallet ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as InvoicePayment;
}

export async function deleteInvoicePayment(client: Client, id: string): Promise<void> {
  const { error } = await client.from('invoice_payments').update({ deleted: true }).eq('id', id);
  if (error) throw error;
}

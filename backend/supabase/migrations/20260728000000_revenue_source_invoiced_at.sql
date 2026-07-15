-- ============================================================================
-- revenue_sources.invoiced_at + external_invoice_id
--
-- invoiced_at: when a revenue source represents money invoiced to the client
-- (distinct from `created_at`, which is only when the row was entered into
-- Chrono — a manager can log an invoice after the fact). Defaults to now() at
-- creation. Also the sort key for the revenue sources list (most recent first).
--
-- external_invoice_id: a free-text reference to the invoice number/id in the
-- manager's own invoicing system (Chrono doesn't issue client-facing invoices
-- itself) — purely a reference for reconciliation, not used in any money calc.
-- ============================================================================

alter table public.revenue_sources
  add column invoiced_at timestamptz not null default now(),
  add column external_invoice_id text null;

comment on column public.revenue_sources.invoiced_at is
  'When this amount was invoiced to the client. Defaults to creation time; sort key for the revenue sources list (most recent first).';

comment on column public.revenue_sources.external_invoice_id is
  'Free-text reference to the invoice number/id in the manager''s own invoicing system. Reconciliation only, not used in any money calc.';

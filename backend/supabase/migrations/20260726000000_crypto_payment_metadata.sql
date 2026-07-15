-- ============================================================================
-- Crypto payment metadata.
--
-- invoice_payments.method is unconstrained text (the allowed values live only
-- in a comment — see 20260715000000_time_accounting_automation.sql), so no
-- enum change is needed to record method = 'crypto'. amount_cents stays the
-- fiat-equivalent settled amount; these columns hold the on-chain specifics.
-- crypto_amount is TEXT, not a numeric/cents column, to preserve 8-18 decimal
-- precision without touching the integer-cents money model used everywhere
-- else in the schema.
-- ============================================================================

alter table public.invoice_payments
  add column crypto_asset   text,   -- e.g. 'BTC', 'ETH', 'USDC'
  add column crypto_amount  text,   -- on-chain amount, full precision, as text
  add column crypto_tx_hash text,
  add column crypto_wallet  text;

comment on column public.invoice_payments.method is
  '''bank_transfer'' | ''card'' | ''cash'' | ''crypto'' | ''other''';

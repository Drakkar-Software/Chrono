-- ============================================================================
-- Foreign-key integrity gap + index coverage behind every foreign key
--
-- READ THIS BEFORE "FIXING" MISSING FOREIGN KEYS FROM THE DASHBOARD:
-- the Supabase schema visualizer only draws public → public relationships.
-- 31 of this schema's foreign keys target auth.users(id), so every user_id /
-- created_by / approved_by / actor_id column *looks* unconstrained there while
-- the constraint is in fact present. Check pg_constraint, not the diagram.
--
-- After this migration exactly two non-PK uuid columns have no FK, both on
-- purpose:
--   companies.product_pool_project_id — would re-create the circular
--     companies ↔ projects dependency rejected in 20260803000000; enforced by
--     the enforce_product_pool_project trigger instead.
--   audit_log.entity_id — polymorphic, discriminated by entity_type.
--
-- Postgres does not index the referencing side of a foreign key. Without one,
-- every parent delete sequential-scans the child: deleting one auth.users row
-- scanned 13 tables and deleting one companies row scanned 8 more, including a
-- nested cascade into jungle_tjm_queue_settlements. This adds the missing
-- indexes.
--
-- Plain `create index` (not `concurrently`): db push runs each migration in a
-- transaction, where concurrently is illegal. It takes a write lock for the
-- duration, which is fine at current table sizes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) rem_lines.user_id — the one real gap
--
-- Declared bare in 20260803000000 (`user_id uuid,  -- null for company_fee
-- bucket`) while its sibling project_id got a FK. It holds a company_members
-- user id, i.e. an auth.users id, on a financial ledger.
--
-- Orphans are cleaned first so the constraint cannot block the push. This is
-- safe: rem_lines is fully derived — compute_rem_month opens by deleting every
-- line of the month and rebuilding it. A line whose user no longer exists in
-- auth.users has already lost its company_members row (that FK cascades), so it
-- can never be recomputed and carries nothing worth keeping. Same precedent as
-- the zero-cent cleanup in 20260806000000.
-- ----------------------------------------------------------------------------
delete from public.rem_lines l
where l.user_id is not null
  and not exists (select 1 from auth.users u where u.id = l.user_id);

alter table public.rem_lines
  drop constraint if exists rem_lines_user_id_fkey;

alter table public.rem_lines
  add constraint rem_lines_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- auth.users, not profiles(user_id): that matches every other person column
-- that is not PostgREST-embedded (time_entries.user_id, notifications.user_id,
-- time_off.user_id, project_costs.user_id). The four profiles mirrors added in
-- 20260719000000 exist only to make `profiles(...)` embeds resolve; adding more
-- of those to a table with several actor columns causes PGRST201 ambiguity.
--
-- The column stays nullable — null means the company_fee bucket, which has no
-- person attached. A nullable FK ignores null rows.

-- ----------------------------------------------------------------------------
-- 2) Index coverage: NOT NULL foreign-key columns
--
-- revenue_entries.revenue_source_id is a regression, not an oversight:
-- 20260806000000 dropped `unique (revenue_source_id, period_month)` and
-- replaced it with a partial unique index (where auto_generated and not
-- deleted). A partial index cannot serve a referential-integrity check, so the
-- column silently lost its coverage. The partial unique index stays — it still
-- enforces one auto row per source-month.
-- ----------------------------------------------------------------------------
create index if not exists revenue_entries_company_idx
  on public.revenue_entries (company_id);
create index if not exists revenue_entries_source_idx
  on public.revenue_entries (revenue_source_id);

create index if not exists revenue_sources_company_idx
  on public.revenue_sources (company_id);

create index if not exists referral_earnings_company_idx
  on public.referral_earnings (company_id);

create index if not exists project_referrals_company_idx
  on public.project_referrals (company_id);

create index if not exists notifications_company_idx
  on public.notifications (company_id);

create index if not exists time_off_company_idx
  on public.time_off (company_id);

-- The jungle queue's two existing indexes are both partial (where deleted =
-- false) and neither leads with user_id, so all three of its FK columns are
-- uncovered.
create index if not exists jungle_queue_company_idx
  on public.jungle_tjm_queue_entries (company_id);
create index if not exists jungle_queue_project_idx
  on public.jungle_tjm_queue_entries (project_id);
create index if not exists jungle_queue_user_idx
  on public.jungle_tjm_queue_entries (user_id);

create index if not exists jungle_queue_settlements_company_idx
  on public.jungle_tjm_queue_settlements (company_id);
create index if not exists jungle_queue_settlements_entry_idx
  on public.jungle_tjm_queue_settlements (queue_entry_id);

-- ----------------------------------------------------------------------------
-- 3) Index coverage: nullable actor columns
--
-- Partial `where <col> is not null` keeps these small — most rows are null.
-- The RI probe is `col = $1`, which implies `col is not null`, so the planner
-- can still use them.
-- ----------------------------------------------------------------------------
create index if not exists projects_created_by_idx
  on public.projects (created_by) where created_by is not null;

create index if not exists time_entries_approved_by_idx
  on public.time_entries (approved_by) where approved_by is not null;

create index if not exists revenue_sources_created_by_idx
  on public.revenue_sources (created_by) where created_by is not null;

create index if not exists company_invites_invited_by_idx
  on public.company_invites (invited_by) where invited_by is not null;
create index if not exists company_invites_accepted_by_idx
  on public.company_invites (accepted_by) where accepted_by is not null;

create index if not exists invoice_payments_recorded_by_idx
  on public.invoice_payments (recorded_by) where recorded_by is not null;

create index if not exists audit_log_actor_idx
  on public.audit_log (actor_id) where actor_id is not null;

-- project_costs.company_id is already covered by project_costs_company_status_idx
-- (company_id leading). These four are not.
create index if not exists project_costs_user_idx
  on public.project_costs (user_id) where user_id is not null;
create index if not exists project_costs_approved_by_idx
  on public.project_costs (approved_by) where approved_by is not null;
create index if not exists project_costs_reimbursed_by_idx
  on public.project_costs (reimbursed_by) where reimbursed_by is not null;
create index if not exists project_costs_created_by_idx
  on public.project_costs (created_by) where created_by is not null;

-- rem_lines_user_idx is (company_id, user_id), so user_id is not leading and
-- cannot serve the FK added above. rem_lines_month_idx does not cover
-- project_id either.
create index if not exists rem_lines_user_fk_idx
  on public.rem_lines (user_id) where user_id is not null;
create index if not exists rem_lines_project_idx
  on public.rem_lines (project_id) where project_id is not null;

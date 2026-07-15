-- ============================================================================
-- Per-member weekly capacity (days/week available), for utilization reporting.
--
-- Chrono only tracked actual logged time, with no notion of how much time a
-- freelancer is expected to work — so managers had no way to see who is
-- over/under-booked. This adds the missing capacity denominator; utilization
-- itself (worked days / capacity days) is computed client-side, see
-- packages/sdk/src/capacity/capacity.lib.ts.
-- ============================================================================

alter table public.company_members
  add column weekly_capacity_days numeric not null default 5
    check (weekly_capacity_days >= 0 and weekly_capacity_days <= 7);

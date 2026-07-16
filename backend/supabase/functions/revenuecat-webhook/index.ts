// RevenueCat webhook — syncs Chrono Pro seat-tier subscription state onto
// `public.company_subscriptions`. This is the write path for that table (it
// has no authenticated insert/update policies); it runs with the service
// role so it bypasses RLS.
//
// Configure in the RevenueCat dashboard: Project settings > Integrations >
// Webhooks, URL = this function's deployed URL, Authorization header =
// REVENUECAT_WEBHOOK_SECRET (set below via `supabase secrets set`).
//
// Docs: https://www.revenuecat.com/docs/integrations/webhooks

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Store product identifiers we created via the RevenueCat MCP tools — keep in
// sync with apps/mobile/src/lib/revenuecat-constants.ts (`PRODUCT_PLAN_MAP`).
const PRODUCT_PLAN_MAP: Record<string, { plan: 'solo' | 'team' | 'scale'; seatLimit: number }> = {
  chrono_pro_solo: { plan: 'solo', seatLimit: 3 },
  chrono_pro_team: { plan: 'team', seatLimit: 10 },
  chrono_pro_scale: { plan: 'scale', seatLimit: 25 },
};

const COMPANY_APP_USER_ID_PREFIX = 'company_';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  product_id?: string;
  store?: string;
  expiration_at_ms?: number | null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Fail CLOSED: an unset secret must reject every request, not skip the
  // check. This handler runs with the service role (bypasses RLS) and writes
  // Chrono Pro status directly — a missing REVENUECAT_WEBHOOK_SECRET must
  // never turn into an open door. Set it with `supabase secrets set`.
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret || req.headers.get('Authorization') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { event } = (await req.json()) as { event: RevenueCatEvent };
  if (!event?.app_user_id?.startsWith(COMPANY_APP_USER_ID_PREFIX)) {
    // Not a company-scoped subscriber (e.g. a pre-login anonymous id) —
    // nothing for us to sync. 200 so RevenueCat doesn't retry.
    return new Response('ignored: not a company app_user_id', { status: 200 });
  }
  const companyId = event.app_user_id.slice(COMPANY_APP_USER_ID_PREFIX.length);
  const tier = event.product_id ? PRODUCT_PLAN_MAP[event.product_id] : undefined;
  const currentPeriodEnd = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : undefined;

  const patch: Record<string, unknown> = {};
  switch (event.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
      patch.status = 'active';
      if (tier) {
        patch.plan = tier.plan;
        patch.seat_limit = tier.seatLimit;
      }
      if (event.store) patch.store = event.store;
      if (currentPeriodEnd) patch.current_period_end = currentPeriodEnd;
      break;
    case 'CANCELLATION':
      // Auto-renew turned off — access continues until expiration_at_ms.
      // EXPIRATION (below) is what actually ends access.
      if (currentPeriodEnd) patch.current_period_end = currentPeriodEnd;
      break;
    case 'EXPIRATION':
      patch.status = 'expired';
      break;
    case 'BILLING_ISSUE':
      patch.status = 'past_due';
      break;
    default:
      // Unhandled event type (e.g. TRANSFER) — ack without writing.
      return new Response('ignored: unhandled event type', { status: 200 });
  }

  if (Object.keys(patch).length === 0) {
    return new Response('ok: no-op', { status: 200 });
  }

  const { error } = await supabase
    .from('company_subscriptions')
    .update(patch)
    .eq('company_id', companyId);

  if (error) {
    console.error('company_subscriptions update failed', error);
    return new Response(`error: ${error.message}`, { status: 500 });
  }

  return new Response('ok', { status: 200 });
});

// Supabase Edge Function: fan a new notification row out to the recipient's
// Expo push tokens.
//
// Wire it up as a Database Webhook (Dashboard → Database → Webhooks) on
// INSERT of `public.notifications`, pointing at this function. The webhook
// delivers `{ type, record, ... }`; we look up the recipient's device tokens
// and hand them to the Expo push service. No app servers required.
//
// Deploy: `supabase functions deploy send-push`
// Env (auto-injected in hosted Functions): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface NotificationRecord {
  user_id: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  record: NotificationRecord | null;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as WebhookPayload;
    if (payload.type !== 'INSERT' || !payload.record?.user_id) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    const record = payload.record;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: tokens, error } = await supabase
      .from('device_tokens')
      .select('token')
      .eq('user_id', record.user_id);
    if (error) throw error;

    const messages = (tokens ?? []).map((t: { token: string }) => ({
      to: t.token,
      title: record.title,
      body: record.body ?? undefined,
      data: record.data ?? {},
      sound: 'default',
    }));

    if (messages.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const receipt = await res.json();

    // Clean up tokens Expo reports as no longer registered.
    const dead: string[] = [];
    const data = Array.isArray(receipt?.data) ? receipt.data : [];
    data.forEach((r: { status?: string; details?: { error?: string } }, i: number) => {
      if (r?.status === 'error' && r.details?.error === 'DeviceNotRegistered') {
        const token = messages[i]?.to;
        if (token) dead.push(token);
      }
    });
    if (dead.length) {
      await supabase.from('device_tokens').delete().in('token', dead);
    }

    return new Response(JSON.stringify({ sent: messages.length, pruned: dead.length }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});

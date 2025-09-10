import type { RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { getServiceClient } from '$lib/supabase/server';

const schema = z.object({
  title: z.string().optional(), // allow empty/default title
  durationMinutes: z.number().min(15).max(480),
  timezoneMode: z.enum(['local', 'organizer', 'utc']).default('local'),
  fairnessMode: z.boolean().default(false),
  quietHours: z.object({ start: z.number().min(0).max(23), end: z.number().min(0).max(23) }).default({ start: 22, end: 7 })
});

export const POST: RequestHandler = async ({ request }) => {
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Invalid input', details: e?.issues ?? String(e) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Default poll window: today .. +7 days (UTC dates)
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 7);

  let supabase;
  try {
    supabase = getServiceClient();
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: 'Server not configured', hint: 'Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { data: poll, error: pollErr } = await supabase
    .from('polls')
    .insert({
      title: (input.title ?? '').trim(),
      duration_minutes: input.durationMinutes,
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      timezone_mode: input.timezoneMode,
      fairness_mode: input.fairnessMode
    })
    .select('id')
    .single();

  if (pollErr || !poll) {
    return new Response(
      JSON.stringify({ error: 'Failed to create poll', details: pollErr?.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Generate a 48-hex-char opaque token
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const { error: tokenErr } = await supabase.from('poll_link_tokens').insert({ poll_id: poll.id, token, active: true });
  if (tokenErr) {
    return new Response(
      JSON.stringify({ error: 'Failed to create link token', details: tokenErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const link = `/p/${poll.id}?t=${token}`;
  return new Response(JSON.stringify({ id: poll.id, token, link }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
};


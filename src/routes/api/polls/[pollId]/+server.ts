import type { RequestHandler } from '@sveltejs/kit';
import { getServiceClient } from '$lib/supabase/server';
import { z } from 'zod';

export const GET: RequestHandler = async ({ params, url }) => {
  const pollId = params.pollId;
  const token = url.searchParams.get('t');
  if (!pollId) {
    return new Response(JSON.stringify({ error: 'Missing poll id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing token' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  let supabase;
  try {
    supabase = getServiceClient();
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  // Validate token is active for this poll
  const { data: link, error: linkErr } = await supabase
    .from('poll_link_tokens')
    .select('id, active')
    .eq('poll_id', pollId)
    .eq('token', token)
    .single();

  if (linkErr || !link || !link.active) {
    return new Response(JSON.stringify({ error: 'Invalid or inactive token' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const { data: poll, error: pollErr } = await supabase
    .from('polls')
    .select('id, title, description, duration_minutes, start_date, end_date, timezone_mode, fairness_mode, created_at, updated_at')
    .eq('id', pollId)
    .single();

  if (pollErr || !poll) {
    return new Response(JSON.stringify({ error: 'Poll not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  const { data: participants } = await supabase
    .from('participants')
    .select('id, name, email, tz, quiet_start, quiet_end, invited_at, responded_at')
    .eq('poll_id', pollId)
    .order('invited_at', { ascending: true });

  const { data: availabilities } = await supabase
    .from('availabilities')
    .select('id, participant_id, start_ts, end_ts')
    .eq('poll_id', pollId)
    .order('start_ts', { ascending: true });

  return new Response(
    JSON.stringify({ poll, participants: participants ?? [], availabilities: availabilities ?? [] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

// Update poll settings
const PatchSchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  duration_minutes: z.number().int().min(15).max(480).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timezone_mode: z.enum(['local', 'organizer', 'utc']).optional(),
  fairness_mode: z.boolean().optional()
});

export const PATCH: RequestHandler = async ({ params, request }) => {
  const pollId = params.pollId;
  if (!pollId) return new Response(JSON.stringify({ error: 'Missing poll id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await request.json());
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Invalid input', details: e?.issues ?? String(e) }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  let supabase;
  try { supabase = getServiceClient(); } catch {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  const { data, error } = await supabase.from('polls').update(body).eq('id', pollId).select('*').single();
  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to update', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ poll: data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};


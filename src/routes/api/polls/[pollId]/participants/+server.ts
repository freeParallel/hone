import type { RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { getServiceClient } from '$lib/supabase/server';

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')).optional(),
  tz: z.string().min(1).default('UTC'),
});

export const POST: RequestHandler = async ({ params, url, request }) => {
  const pollId = params.pollId;
  const token = url.searchParams.get('t');
  if (!pollId) return new Response(JSON.stringify({ error: 'Missing poll id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  if (!token) return new Response(JSON.stringify({ error: 'Missing token' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Invalid input', details: e?.issues ?? String(e) }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  let supabase;
  try {
    supabase = getServiceClient();
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  // Validate token
  const { data: link, error: linkErr } = await supabase
    .from('poll_link_tokens')
    .select('id, active')
    .eq('poll_id', pollId)
    .eq('token', token)
    .single();
  if (linkErr || !link || !link.active) {
    return new Response(JSON.stringify({ error: 'Invalid or inactive token' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const { data: participant, error: insErr } = await supabase
    .from('participants')
    .insert({ poll_id: pollId, name: body.name, email: body.email || null, tz: body.tz })
    .select('id, name, email, tz, quiet_start, quiet_end')
    .single();

  if (insErr || !participant) {
    return new Response(JSON.stringify({ error: 'Failed to create participant', details: insErr?.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ participant }), { status: 201, headers: { 'Content-Type': 'application/json' } });
};


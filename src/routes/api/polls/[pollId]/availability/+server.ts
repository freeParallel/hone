import type { RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { getServiceClient } from '$lib/supabase/server';

const Block = z.object({ start: z.string(), end: z.string() });
const Body = z.object({
  participant_id: z.string().uuid(),
  blocks: z.array(Block).min(1),
  replace: z.boolean().optional().default(true)
});

export const POST: RequestHandler = async ({ params, url, request }) => {
  const pollId = params.pollId;
  const token = url.searchParams.get('t');
  if (!pollId) return jsonErr('Missing poll id', 400);
  if (!token) return jsonErr('Missing token', 400);

  let input: z.infer<typeof Body>;
  try {
    input = Body.parse(await request.json());
  } catch (e: any) {
    return jsonErr('Invalid input', 400, e?.issues ?? String(e));
  }

  // Normalize and validate times
  const blocksNorm = input.blocks.map((b) => {
    const start = new Date(b.start);
    const end = new Date(b.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('Invalid date format');
    if (end <= start) throw new Error('end must be > start');
    return { start_ts: start.toISOString(), end_ts: end.toISOString() };
  });

  let supabase;
  try {
    supabase = getServiceClient();
  } catch {
    return jsonErr('Server not configured', 500);
  }

  // Validate link token is active
  const { data: link, error: linkErr } = await supabase
    .from('poll_link_tokens')
    .select('id, active')
    .eq('poll_id', pollId)
    .eq('token', token)
    .single();
  if (linkErr || !link || !link.active) return jsonErr('Invalid or inactive token', 403);

  // Validate participant belongs to poll
  const { data: participant, error: partErr } = await supabase
    .from('participants')
    .select('id')
    .eq('id', input.participant_id)
    .eq('poll_id', pollId)
    .single();
  if (partErr || !participant) return jsonErr('Participant does not belong to poll', 403);

  // Replace existing blocks if requested
  if (input.replace) {
    const { error: delErr } = await supabase
      .from('availabilities')
      .delete()
      .eq('poll_id', pollId)
      .eq('participant_id', input.participant_id);
    if (delErr) return jsonErr('Failed to clear existing availability', 500, delErr.message);
  }

  // Insert new blocks
  const rows = blocksNorm.map((r) => ({
    poll_id: pollId,
    participant_id: input.participant_id,
    start_ts: r.start_ts,
    end_ts: r.end_ts
  }));
  const { error: insErr } = await supabase.from('availabilities').insert(rows);
  if (insErr) return jsonErr('Failed to save availability', 500, insErr.message);

  return new Response(JSON.stringify({ ok: true, inserted: rows.length }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
};

function jsonErr(msg: string, status = 400, details?: unknown) {
  return new Response(JSON.stringify({ error: msg, details }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}


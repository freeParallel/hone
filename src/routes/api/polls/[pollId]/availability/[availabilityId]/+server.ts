import type { RequestHandler } from '@sveltejs/kit';
import { getServiceClient } from '$lib/supabase/server';

export const DELETE: RequestHandler = async ({ params, url }) => {
  const pollId = params.pollId;
  const availabilityId = params.availabilityId;
  const token = url.searchParams.get('t');
  const participantId = url.searchParams.get('pid');

  if (!pollId || !availabilityId) {
    return jsonErr('Missing poll or availability id', 400);
  }
  if (!token) return jsonErr('Missing token', 400);
  if (!participantId) return jsonErr('Missing participant id (pid)', 400);

  let supabase;
  try {
    supabase = getServiceClient();
  } catch {
    return jsonErr('Server not configured', 500);
  }

  // Validate token
  const { data: link, error: linkErr } = await supabase
    .from('poll_link_tokens')
    .select('id, active')
    .eq('poll_id', pollId)
    .eq('token', token)
    .single();
  if (linkErr || !link || !link.active) return jsonErr('Invalid or inactive token', 403);

  // Fetch the availability row
  const { data: row, error: rowErr } = await supabase
    .from('availabilities')
    .select('id, poll_id, participant_id')
    .eq('id', availabilityId)
    .single();
  if (rowErr || !row) return jsonErr('Availability not found', 404);

  // Ensure the row belongs to this poll and participant
  if (row.poll_id !== pollId) return jsonErr('Mismatched poll', 403);
  if (row.participant_id !== participantId) return jsonErr('Not allowed to delete this block', 403);

  const { error: delErr } = await supabase
    .from('availabilities')
    .delete()
    .eq('id', availabilityId);
  if (delErr) return jsonErr('Failed to delete availability', 500, delErr.message);

  return new Response(null, { status: 204 });
};

function jsonErr(msg: string, status = 400, details?: unknown) {
  return new Response(JSON.stringify({ error: msg, details }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}


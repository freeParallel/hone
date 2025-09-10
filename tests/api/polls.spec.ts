import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const base = process.env.BASE_URL || 'http://127.0.0.1:5173';

// Utility: optional cleanup via Supabase service role if env present
async function cleanupPoll(pollId: string) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return; // skip cleanup
  const supa = createClient(url, serviceKey, { auth: { persistSession: false } });
  await supa.from('polls').delete().eq('id', pollId);
}

test('poll lifecycle: create → get → join → add availability → delete', async ({ request }) => {
  // 1) Create poll
  const title = `e2e-${Date.now()}`;
  const createRes = await request.post(`${base}/api/polls`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      title,
      durationMinutes: 60,
      timezoneMode: 'local',
      fairnessMode: false,
      quietHours: { start: 22, end: 7 }
    }
  });
  expect(createRes.ok()).toBeTruthy();
  const created = await createRes.json();
  expect(created.id).toBeTruthy();
  expect(created.token).toBeTruthy();

  const pollId = created.id as string;
  const token = created.token as string;

  try {
    // 2) Get snapshot
    const getRes = await request.get(`${base}/api/polls/${pollId}?t=${token}`);
    expect(getRes.ok()).toBeTruthy();
    const snap = await getRes.json();
    expect(snap.poll.title).toBe(title);

    // 3) Join participant
    const joinRes = await request.post(`${base}/api/polls/${pollId}/participants?t=${token}`, {
      headers: { 'Content-Type': 'application/json' },
      data: { name: 'E2E Tester', email: '', tz: 'UTC' }
    });
    expect(joinRes.ok()).toBeTruthy();
    const joined = await joinRes.json();
    const participantId = joined.participant.id as string;
    expect(participantId).toBeTruthy();

    // 4) Add availability (append)
    const start = new Date(Date.now() + 3600_000).toISOString();
    const end = new Date(Date.now() + 7200_000).toISOString();
    const availRes = await request.post(`${base}/api/polls/${pollId}/availability?t=${token}`, {
      headers: { 'Content-Type': 'application/json' },
      data: { participant_id: participantId, blocks: [{ start, end }], replace: false }
    });
    expect(availRes.ok()).toBeTruthy();

    // 5) Get snapshot and delete the block we just added
    const get2 = await request.get(`${base}/api/polls/${pollId}?t=${token}`);
    expect(get2.ok()).toBeTruthy();
    const snap2 = await get2.json();
    const myBlocks = (snap2.availabilities as any[]).filter((a) => a.participant_id === participantId);
    expect(myBlocks.length).toBeGreaterThan(0);

    const toDelete = myBlocks[myBlocks.length - 1];
    const delRes = await request.delete(`${base}/api/polls/${pollId}/availability/${toDelete.id}?t=${token}&pid=${participantId}`);
    expect(delRes.status()).toBe(204);
  } finally {
    await cleanupPoll(pollId);
  }
});


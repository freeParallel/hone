<script lang="ts">
  import { page } from '$app/stores';
  import { onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { supabase } from '$lib/supabase/client';
  import TimelineHorizon from '$lib/components/TimelineHorizon.svelte';

  type Poll = {
    id: string;
    title: string | null;
    description: string | null;
    duration_minutes: number;
    start_date: string;
    end_date: string;
    timezone_mode: 'local' | 'organizer' | 'utc';
    fairness_mode: boolean;
  };

  let pollId = '';
  $: pollId = $page.params.pollId as string;

  let token: string | null = null;
  let loading = true;
  let error = '';
  let poll: Poll | null = null;
  let participants: any[] = [];
  let availabilities: any[] = [];
  let participantId: string | null = null;

  // For CLI helpers
  let base = '';
  $: if (browser) base = window.location.origin;
  let myAvailabilities: any[] = [];
  $: myAvailabilities = (availabilities || []).filter((a) => participantId && a.participant_id === participantId);

  const exampleCurl = `# Read snapshot
curl "$BASE/api/polls/$POLL_ID?t=$TOKEN"

# Append a block
curl -X POST "$BASE/api/polls/$POLL_ID/availability?t=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"participant_id":"'$PARTICIPANT_ID'","blocks":[{"start":"2025-09-11T09:00:00Z","end":"2025-09-11T10:00:00Z"}],"replace":false}'

# Replace all blocks
curl -X POST "$BASE/api/polls/$POLL_ID/availability?t=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"participant_id":"'$PARTICIPANT_ID'","blocks":[{"start":"2025-09-12T09:00:00Z","end":"2025-09-12T10:30:00Z"}],"replace":true}'

# Delete one block (pick an ID from the list above)
# AVAILABILITY_ID=...
curl -X DELETE "$BASE/api/polls/$POLL_ID/availability/$AVAILABILITY_ID?t=$TOKEN&pid=$PARTICIPANT_ID" -i`;

  onMount(async () => {
    if (!browser) return;
    token = $page.url.searchParams.get('t');
    if (!token) {
      error = 'Missing access token';
      loading = false;
      return;
    }
    try {
      const res = await fetch(`/api/polls/${pollId}?t=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load poll');
      poll = json.poll;
      participants = json.participants ?? [];
      availabilities = json.availabilities ?? [];

      // read stored participant id if present
      const key = `participant:${pollId}`;
      participantId = localStorage.getItem(key);
    } catch (e: any) {
      error = e?.message ?? 'Unexpected error';
    } finally {
      loading = false;
    }
  });

  // Realtime subscription stub (requires Supabase Realtime configured)
  let channel: ReturnType<typeof supabase.channel> | null = null;
  $: if (pollId) {
    channel = supabase
      .channel(`poll:${pollId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availabilities', filter: `poll_id=eq.${pollId}` }, (payload) => {
        console.log('Realtime payload', payload);
      })
      .subscribe();
  }
  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
  });

  // Join form state
  let name = '';
  let email = '';
  const tzGuess = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  let joinLoading = false;
  async function join(ev: Event) {
    ev.preventDefault();
    if (!token) return;
    joinLoading = true;
    try {
      const res = await fetch(`/api/polls/${pollId}/participants?t=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, tz: tzGuess })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to join poll');
      participantId = json.participant.id;
      localStorage.setItem(`participant:${pollId}`, participantId);
    } catch (e: any) {
      error = e?.message ?? 'Failed to join';
    } finally {
      joinLoading = false;
    }
  }

  // Minimal availability form
  let aStart = '';
  let aEnd = '';
  let replaceAll = false;
  let saveAvailLoading = false;
  async function saveAvailability(ev: Event) {
    ev.preventDefault();
    if (!token || !participantId) return;
    saveAvailLoading = true;
    try {
      const body = {
        participant_id: participantId,
        blocks: [{ start: aStart, end: aEnd }],
        replace: replaceAll
      };
      const res = await fetch(`/api/polls/${pollId}/availability?t=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to save availability');
      // refresh snapshot
      const r2 = await fetch(`/api/polls/${pollId}?t=${encodeURIComponent(token)}`);
      const j2 = await r2.json();
      if (r2.ok) {
        availabilities = j2.availabilities ?? [];
      }
      aStart = '';
      aEnd = '';
    } catch (e: any) {
      error = e?.message ?? 'Failed to save availability';
    } finally {
      saveAvailLoading = false;
    }
  }

  async function deleteAvailability(id: string) {
    if (!token || !participantId) return;
    try {
      const res = await fetch(`/api/polls/${pollId}/availability/${id}?t=${encodeURIComponent(token)}&pid=${encodeURIComponent(participantId)}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        try { const j = await res.json(); throw new Error(j?.error || 'Delete failed'); } catch { throw new Error('Delete failed'); }
      }
      // refresh snapshot
      const r2 = await fetch(`/api/polls/${pollId}?t=${encodeURIComponent(token)}`);
      const j2 = await r2.json();
      if (r2.ok) {
        availabilities = j2.availabilities ?? [];
      }
    } catch (e: any) {
      error = e?.message ?? 'Failed to delete availability';
    }
  }
</script>

<section class="max-w-6xl mx-auto p-6 space-y-6">
  {#if loading}
    <p>Loading…</p>
  {:else if error}
    <p class="text-red-400">{error}</p>
  {:else}
    <h2 class="text-2xl font-semibold">{poll?.title || 'Untitled poll'}</h2>
    <p class="text-sm opacity-70">Window: {poll?.start_date} → {poll?.end_date} • Duration: {poll?.duration_minutes}m</p>

    {#if !participantId}
      <form class="mt-4 grid gap-3 max-w-md" on:submit|preventDefault={join}>
        <div>
          <label for="name" class="block text-sm mb-1">Your name</label>
          <input id="name" class="w-full px-3 py-2 rounded bg-neutral-900 text-white border border-neutral-700" bind:value={name} required />
        </div>
        <div>
          <label for="email" class="block text-sm mb-1">Email (optional)</label>
          <input id="email" type="email" class="w-full px-3 py-2 rounded bg-neutral-900 text-white border border-neutral-700" bind:value={email} />
          <p class="text-xs opacity-60 mt-1">Optional. Used only to send you the final meeting time. No marketing.</p>
        </div>
        <button class="px-4 py-2 rounded bg-white text-black" disabled={joinLoading}>{joinLoading ? 'Joining…' : 'Join poll'}</button>
      </form>
    {/if}

    <div class="rounded border border-neutral-800 p-4 mt-6">
      <TimelineHorizon />
    </div>

    {#if participantId}
      <div class="mt-6 grid gap-3 max-w-md">
        <h3 class="font-semibold">Add availability (quick form)</h3>
        <form class="grid gap-3" on:submit|preventDefault={saveAvailability}>
          <div>
            <label for="aStart" class="block text-sm mb-1">Start (local)</label>
            <input id="aStart" type="datetime-local" class="w-full px-3 py-2 rounded bg-neutral-900 text-white border border-neutral-700" bind:value={aStart} required />
          </div>
          <div>
            <label for="aEnd" class="block text-sm mb-1">End (local)</label>
            <input id="aEnd" type="datetime-local" class="w-full px-3 py-2 rounded bg-neutral-900 text-white border border-neutral-700" bind:value={aEnd} required />
          </div>
          <div class="flex items-center gap-2">
            <input id="replaceAll" type="checkbox" bind:checked={replaceAll} />
            <label for="replaceAll">Replace all my availability</label>
          </div>
          <button class="px-4 py-2 rounded bg-white text-black" disabled={saveAvailLoading}>{saveAvailLoading ? 'Saving…' : 'Add block'}</button>
        </form>
        <p class="text-xs opacity-60">Toggle “Replace all” to overwrite all your existing availability with the new block(s). Otherwise, blocks are appended.</p>
      </div>
    {/if}

    <div class="mt-6">
      <h3 class="font-semibold mb-2">Current availability (all participants)</h3>
      {#if availabilities.length === 0}
        <p class="text-sm opacity-70">No availability yet.</p>
      {:else}
        <ul class="text-sm space-y-1">
      {#each availabilities as a}
            <li class="flex items-center justify-between gap-3">
              <span>• {a.participant_id.slice(0, 8)}…: {a.start_ts} → {a.end_ts}</span>
              {#if participantId === a.participant_id}
                <button class="text-xs px-2 py-1 rounded border border-red-500 text-red-300 hover:bg-red-500/10"
                  on:click|preventDefault={() => deleteAvailability(a.id)}>Delete</button>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="text-sm text-neutral-500 mt-6">Realtime updates will appear in console for now.</div>

    <div class="mt-8 rounded-md border border-neutral-800 p-4 text-sm">
      <h3 class="font-semibold mb-2">API testing helpers</h3>
      <div class="grid gap-2">
        <div>Base URL: <code class="px-2 py-1 rounded bg-neutral-900 border border-neutral-700">{base}</code></div>
        <div>Poll ID: <code class="px-2 py-1 rounded bg-neutral-900 border border-neutral-700">{pollId}</code></div>
        <div>Token (t): <code class="px-2 py-1 rounded bg-neutral-900 border border-neutral-700">{token ?? '—'}</code></div>
        <div>Participant ID: <code class="px-2 py-1 rounded bg-neutral-900 border border-neutral-700">{participantId ?? 'Join to get your ID'}</code></div>
      </div>

      {#if myAvailabilities.length > 0}
        <div class="mt-3">
          <div class="mb-1">Your availability IDs (for delete):</div>
          <ul class="space-y-1">
            {#each myAvailabilities as ma}
              <li><code class="px-2 py-1 rounded bg-neutral-900 border border-neutral-700">{ma.id}</code> — {ma.start_ts} → {ma.end_ts}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="mt-4">
        <div class="mb-1">Shell exports (copy/paste):</div>
        <pre class="p-4 rounded bg-neutral-900 border border-neutral-700"><code>export BASE={base}
export POLL_ID={pollId}
export TOKEN={token}
export PARTICIPANT_ID={participantId ?? ''}</code></pre>
      </div>

      <div class="mt-3">
        <div class="mb-1">Examples:</div>
        <pre class="p-4 rounded bg-neutral-900 border border-neutral-700 overflow-auto"><code>{exampleCurl}</code></pre>
      </div>
    </div>
  {/if}
</section>


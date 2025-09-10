<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import TimelineHorizon from '$lib/components/TimelineHorizon.svelte';
  import GridCalendar from '$lib/components/GridCalendar.svelte';

  import { page } from '$app/stores';

  let pollId = '';
  $: pollId = $page.params.pollId as string;

  let token: string | null = null;
  let loading = true;
  let error = '';
  let poll: any = null;

  onMount(async () => {
    token = $page.url.searchParams.get('t');
    if (!token) { error = 'Missing token'; loading = false; return; }
    try {
      const res = await fetch(`/api/polls/${pollId}?t=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load');
      poll = json.poll;
    } catch (e:any) {
      error = e?.message || 'Failed to load';
    } finally { loading = false; }
  });

  async function save(field: string, value: any) {
    if (!pollId) return;
    try {
      const res = await fetch(`/api/polls/${pollId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) });
      if (!res.ok) { const j=await res.json(); throw new Error(j?.error||'Save failed'); }
      const j = await res.json(); poll = j.poll;
    } catch (e:any) { error = e?.message || 'Save failed'; }
  }
</script>

<section class="max-w-3xl mx-auto p-6 space-y-4 text-white">
  <h2 class="text-2xl font-semibold">Poll created</h2>
  {#if error}
    <p class="text-red-400">{error}</p>
  {/if}
  {#if loading}
    <p>Loading…</p>
  {:else if poll}
    <div class="space-y-2 text-sm">
      <div>Poll ID: <code class="px-2 py-1 rounded bg-neutral-900 border border-neutral-700">{pollId}</code></div>
      <div>Invite link: <a class="underline" href={`/p/${pollId}?t=${token}`} target="_blank" rel="noreferrer">/p/{pollId}?t={token}</a></div>
      <button class="px-3 py-2 rounded bg-white text-black" on:click={() => goto(`/p/${pollId}?t=${token}`)}>Open poll page</button>
    </div>

    <div class="mt-4 p-4 rounded border border-neutral-800 space-y-3">
      <h4 class="font-semibold">Settings</h4>
      <div class="grid gap-3">
        <label class="text-sm">Title
          <input class="w-full px-3 py-2 rounded bg-neutral-900 text-white border border-neutral-700" value={poll.title||''} on:change={(e:any)=>save('title', e.currentTarget.value)} />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-sm">Start date
            <input type="date" class="w-full px-3 py-2 rounded bg-neutral-900 text-white border border-neutral-700" value={poll.start_date} on:change={(e:any)=>save('start_date', e.currentTarget.value)} />
          </label>
          <label class="text-sm">End date
            <input type="date" class="w-full px-3 py-2 rounded bg-neutral-900 text-white border border-neutral-700" value={poll.end_date} on:change={(e:any)=>save('end_date', e.currentTarget.value)} />
          </label>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-sm">Duration (minutes)
            <input type="number" min="15" max="480" class="w-full px-3 py-2 rounded bg-neutral-900 text-white border border-neutral-700" value={poll.duration_minutes} on:change={(e:any)=>save('duration_minutes', Number(e.currentTarget.value))} />
          </label>
          <label class="text-sm">Timezone Mode
            <select class="w-full px-3 py-2 rounded bg-neutral-900 text-white border border-neutral-700" value={poll.timezone_mode} on:change={(e:any)=>save('timezone_mode', e.currentTarget.value)}>
              <option value="local">Local</option>
              <option value="organizer">Organizer</option>
              <option value="utc">UTC</option>
            </select>
          </label>
        </div>
      </div>
    </div>

    <div class="mt-4 p-4 rounded border border-neutral-800">
      <h4 class="font-semibold mb-2">Calendar preview</h4>
      <GridCalendar start_date={poll.start_date} end_date={poll.end_date} duration={poll.duration_minutes} myBlocks={[]} otherBlocks={[]} disabled={true} />
    </div>
  {/if}
</section>


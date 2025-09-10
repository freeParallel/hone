<script lang="ts">
  import { z } from 'zod';
  import { goto } from '$app/navigation';

  const PollSettingsSchema = z.object({
    title: z.string().min(1),
    durationMinutes: z.number().min(15).max(480),
    timezoneMode: z.enum(['local','organizer','utc']).default('local'),
    fairnessMode: z.boolean().default(false),
    quietHours: z.object({ start: z.number().min(0).max(23), end: z.number().min(0).max(23) }).default({ start: 22, end: 7 })
  });

  let form = {
    title: '',
    durationMinutes: 60,
    timezoneMode: 'local',
    fairnessMode: false,
    quietHours: { start: 22, end: 7 }
  } as z.infer<typeof PollSettingsSchema>;

  const durations = [15, 30, 45, 60, 90, 120, 150, 180, 240];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const hh = (n: number) => `${String(n).padStart(2, '0')}:00`;

  let loading = false;
  let error = '';
  async function submit(ev: Event) {
    ev.preventDefault();
    error = '';
    loading = true;
    try {
      // Coerce select values to numbers in case of string binding
      form.durationMinutes = Number(form.durationMinutes);
      form.quietHours.start = Number(form.quietHours.start);
      form.quietHours.end = Number(form.quietHours.end);

      PollSettingsSchema.parse(form);

      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to create poll');
      }

      // analytics: poll created
      try {
        const { default: posthog } = await import('posthog-js');
        if ((import.meta as any).env?.VITE_POSTHOG_KEY) {
          posthog.capture('poll_created', {
            poll_id: json.id,
            duration_minutes: form.durationMinutes,
            timezone_mode: form.timezoneMode,
            fairness_mode: form.fairnessMode
          });
        }
      } catch {}

      await goto(json.link || `/p/${json.id}`);
    } catch (e: any) {
      error = e?.message ?? 'Invalid input';
    } finally {
      loading = false;
    }
  }
</script>

<section class="max-w-2xl mx-auto p-6 space-y-6">
  <h2 class="text-2xl font-semibold">Create a Poll</h2>
  {#if error}
    <p class="text-red-400">{error}</p>
  {/if}
  <form class="space-y-4" on:submit|preventDefault={submit}>
    <div>
      <label for="title" class="block text-sm mb-1">Title</label>
      <input id="title" class="w-full px-3 py-2 rounded bg-neutral-900 text-white border border-neutral-700" bind:value={form.title} required />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="duration" class="block text-sm mb-1">Duration (minutes)</label>
        <select id="duration" class="w-full px-3 py-2 rounded bg-neutral-900 text-white border border-neutral-700" bind:value={form.durationMinutes}>
          {#each durations as d}
            <option value={d}>{d}</option>
          {/each}
        </select>
      </div>
      <div>
        <label for="timezone" class="block text-sm mb-1">Timezone Mode</label>
        <select id="timezone" class="w-full px-3 py-2 rounded bg-neutral-900 text-white border border-neutral-700" bind:value={form.timezoneMode}>
          <option value="local">Local</option>
          <option value="organizer">Organizer</option>
          <option value="utc">UTC</option>
        </select>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <input id="fm" type="checkbox" bind:checked={form.fairnessMode} />
      <label for="fm">Fairness mode (rotate inconvenient times)</label>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="quietStart" class="block text-sm mb-1">Quiet hours start</label>
        <select id="quietStart" class="w-full px-3 py-2 rounded bg-neutral-900 text-white border border-neutral-700" bind:value={form.quietHours.start}>
          {#each hours as h}
            <option value={h}>{hh(h)}</option>
          {/each}
        </select>
      </div>
      <div>
        <label for="quietEnd" class="block text-sm mb-1">Quiet hours end</label>
        <select id="quietEnd" class="w-full px-3 py-2 rounded bg-neutral-900 text-white border border-neutral-700" bind:value={form.quietHours.end}>
          {#each hours as h}
            <option value={h}>{hh(h)}</option>
          {/each}
        </select>
      </div>
    </div>

    <button class="px-4 py-2 rounded bg-white text-black" disabled={loading}>{loading ? 'Creating…' : 'Create'}</button>
  </form>
</section>


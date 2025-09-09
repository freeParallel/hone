<script lang="ts">
  import { page } from '$app/stores';
  import { onDestroy } from 'svelte';
  import { supabase } from '$lib/supabase/client';
  import TimelineHorizon from '$lib/components/TimelineHorizon.svelte';

  let pollId = '';
  $: pollId = $page.params.pollId as string;

  let channel: ReturnType<typeof supabase.channel> | null = null;
  $: if (pollId) {
    channel = supabase
      .channel(`poll:${pollId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'availabilities', filter: `poll_id=eq.${pollId}` },
        (payload) => {
          console.log('Realtime payload', payload);
        }
      )
      .subscribe();
  }
  onDestroy(() => { if (channel) supabase.removeChannel(channel); });
</script>

<section class="max-w-6xl mx-auto p-6 space-y-6">
  <h2 class="text-2xl font-semibold">Poll {pollId}</h2>

  <div class="rounded border border-neutral-800 p-4">
    <TimelineHorizon />
  </div>

  <div class="text-sm text-neutral-500">
    Realtime updates will appear in console for now.
  </div>
</section>


<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  // When visiting /new, create a minimal poll immediately and redirect to /created/:id
  onMount(async () => {
    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '',
          durationMinutes: 60,
          timezoneMode: 'local',
          fairnessMode: false,
          quietHours: { start: 22, end: 7 }
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to create');
      await goto(`/created/${json.id}?t=${encodeURIComponent(json.token)}`);
    } catch (e) {
      console.error(e);
      // fallback: navigate home
      await goto('/');
    }
  });
</script>

<section class="min-h-screen grid place-items-center bg-black text-white p-6">
  <div class="text-center space-y-4">
    <h2 class="text-2xl font-semibold">Creating your poll…</h2>
    <p class="opacity-70">Please wait</p>
  </div>
</section>


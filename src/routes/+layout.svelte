<script lang="ts">
  import "../app.css";
  import posthog from 'posthog-js';
  import { afterNavigate } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  onMount(() => {
    if (browser && (window as any).posthog?.capture) {
      posthog.capture('$pageview');
    }
  });

  afterNavigate(() => {
    if ((window as any).posthog?.capture) {
      posthog.capture('$pageview');
    }
  });
</script>

<div class="min-h-screen bg-black text-white">
  <slot />
</div>


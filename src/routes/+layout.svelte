<script lang="ts">
  import "../app.css";
  import posthog from 'posthog-js';
  import { afterNavigate } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  onMount(() => {
    if (browser && (import.meta as any).env?.VITE_POSTHOG_KEY) {
      posthog.capture('$pageview');
    }
  });

  afterNavigate(() => {
    if ((import.meta as any).env?.VITE_POSTHOG_KEY) {
      posthog.capture('$pageview');
    }
  });
</script>

<slot />


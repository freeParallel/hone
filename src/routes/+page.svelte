<script lang="ts">
  import { goto } from '$app/navigation';

  let input = '';
  let err = '';
  function parseAndGo() {
    err = '';
    const v = input.trim();
    if (!v) return;
    try {
      // Full link
      if (v.startsWith('http://') || v.startsWith('https://')) {
        // If the link is same-origin path, extract path; otherwise, navigate directly
        try {
          const u = new URL(v);
          if (u.pathname.startsWith('/p/')) {
            return goto(`${u.pathname}${u.search}`);
          }
          // external link — still safe to set location
          window.location.href = v;
          return;
        } catch {
          window.location.href = v; return;
        }
      }
      // Accept "<pollId> <token>" (space or newline separated)
      const parts = v.split(/[\s,]+/).filter(Boolean);
      if (parts.length === 2) {
        const [id, token] = parts;
        return goto(`/p/${id}?t=${encodeURIComponent(token)}`);
      }
      // Accept shorthand "<pollId>?t=<token>"
      if (v.includes('?t=')) {
        const [path, query] = v.split('?');
        const id = path.replace(/^.*\//, '');
        const token = new URLSearchParams(query).get('t');
        if (id && token) return goto(`/p/${id}?t=${encodeURIComponent(token)}`);
      }
      err = 'Paste the full invite link or "<pollId> <token>"';
    } catch (e: any) {
      err = e?.message ?? 'Invalid input';
    }
  }
</script>

<section class="min-h-screen grid place-items-center bg-black text-white p-6">
  <div class="text-center space-y-6 max-w-2xl">
    <div class="space-y-2">
      <h1 class="text-4xl font-semibold">H-One</h1>
      <p class="opacity-80">Finding a common point no matter the distance.</p>
    </div>

    <div class="space-x-4">
      <a href="/new" class="underline">Create a poll</a>
      <a href="https://h-one.app" class="underline opacity-80">h-one.app</a>
    </div>

    <div class="mt-6 grid gap-3 text-left">
      <label for="join" class="text-sm opacity-80">Join a poll — paste invite link or "pollId token"</label>
      <div class="flex gap-2 justify-center">
        <input id="join" class="w-full max-w-md px-3 py-2 rounded bg-neutral-900 text-white border border-neutral-700" bind:value={input} placeholder="https://your.app/p/ID?t=TOKEN or ID TOKEN" />
        <button class="px-4 py-2 rounded bg-white text-black" on:click={parseAndGo}>Go</button>
      </div>
      {#if err}
        <p class="text-red-400 text-sm mt-1">{err}</p>
      {/if}
    </div>
  </div>
</section>


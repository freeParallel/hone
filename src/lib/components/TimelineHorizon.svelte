<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  // Props
  export let date: string | null = null; // YYYY-MM-DD (local)
  export let myBlocks: { id: string; start_ts: string; end_ts: string }[] = [];
  export let otherBlocks: { id: string; start_ts: string; end_ts: string }[] = [];
  export let disabled = false;

  const dispatch = createEventDispatcher();

  let container: HTMLDivElement | null = null;
  let width = 0;
  const SNAP_MINUTES = 15;

  function minutesToX(min: number) {
    if (width === 0) return 0;
    return (min / 1440) * width;
  }
  function xToMinutes(x: number) {
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    const clamped = Math.max(0, Math.min(width, x - rect.left));
    const raw = (clamped / width) * 1440;
    return Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
  }
  function composeDate(min: number) {
    if (!date) return null;
    const d = new Date(`${date}T00:00:00`);
    d.setMinutes(d.getMinutes() + min);
    return d;
  }

  let dragging: { type: 'create' | 'resize-start' | 'resize-end'; id?: string; startMin: number; endMin: number } | null = null;
  let hoverMin = 0;

  function onPointerDown(e: PointerEvent) {
    if (disabled || !date) return;
    if (!container) return;
    container.setPointerCapture(e.pointerId);
    const min = xToMinutes(e.clientX);
    dragging = { type: 'create', startMin: min, endMin: min };
  }
  function onPointerMove(e: PointerEvent) {
    if (!container) return;
    hoverMin = xToMinutes(e.clientX);
    if (!dragging) return;
    if (dragging.type === 'create') {
      dragging.endMin = xToMinutes(e.clientX);
    } else if (dragging.type === 'resize-start') {
      dragging.startMin = Math.min(xToMinutes(e.clientX), dragging.endMin - SNAP_MINUTES);
    } else if (dragging.type === 'resize-end') {
      dragging.endMin = Math.max(xToMinutes(e.clientX), dragging.startMin + SNAP_MINUTES);
    }
  }
  function onPointerUp(e: PointerEvent) {
    if (!dragging) return;
    const start = Math.min(dragging.startMin, dragging.endMin);
    const end = Math.max(dragging.startMin, dragging.endMin);
    if (end - start >= SNAP_MINUTES) {
      const startDate = composeDate(start);
      const endDate = composeDate(end);
      if (startDate && endDate) {
        if (dragging.type === 'create') {
          dispatch('add', { start: startDate.toISOString(), end: endDate.toISOString() });
        } else if (dragging.type === 'resize-start' || dragging.type === 'resize-end') {
          dispatch('resize', { id: dragging.id, start: startDate.toISOString(), end: endDate.toISOString() });
        }
      }
    }
    dragging = null;
    if (container) container.releasePointerCapture(e.pointerId);
  }

  function del(id: string) {
    if (disabled) return;
    dispatch('delete', { id });
  }
  function startResize(id: string, edge: 'start' | 'end', e: PointerEvent, startMin: number, endMin: number) {
    if (disabled || !container) return;
    e.stopPropagation();
    container.setPointerCapture(e.pointerId);
    dragging = { type: edge === 'start' ? 'resize-start' : 'resize-end', id, startMin, endMin };
  }

  onMount(() => {
    const ro = new ResizeObserver(() => {
      width = container?.clientWidth || 0;
    });
    if (container) ro.observe(container);
  });

  function blockToMins(b: { start_ts: string; end_ts: string }) {
    // Convert ISO UTC to local minutes offset from midnight of provided date
    if (!date) return { s: 0, e: 0 };
    const base = new Date(`${date}T00:00:00`);
    const s = new Date(b.start_ts);
    const e = new Date(b.end_ts);
    const sMin = (s.getHours() * 60 + s.getMinutes());
    const eMin = (e.getHours() * 60 + e.getMinutes());
    return { s: sMin, e: eMin };
  }
</script>

<style>
  .track { height: 64px; position: relative; }
  .block { position: absolute; top: 8px; height: 48px; border-radius: 6px; }
  .handle { width: 8px; cursor: ew-resize; }
  .tick { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.1); }
</style>

<div class="w-full border border-neutral-800 rounded-md p-3 text-sm text-white select-none">
  <div class="flex items-center justify-between mb-2">
    <div class="opacity-70">{date ? date : 'No date'}</div>
    <div class="opacity-60">Drag to add, grab edges to resize, click ✕ to delete (your blocks)</div>
  </div>

  <div bind:this={container}
       class="track bg-neutral-900 rounded relative"
       on:pointerdown={onPointerDown}
       on:pointermove={onPointerMove}
       on:pointerup={onPointerUp}>

    {#if width}
      {#each Array(24) as _, i}
        <div class="tick" style="left: {minutesToX(i*60)}px; opacity: {i % 6 === 0 ? 0.3 : 0.1}"></div>
      {/each}
    {/if}

    {#each otherBlocks as ob}
      {#if ob}
        <div class="block bg-neutral-700/50" style="left: {minutesToX(blockToMins(ob).s)}px; width: {minutesToX(blockToMins(ob).e - blockToMins(ob).s)}px;"></div>
      {/if}
    {/each}

    {#each myBlocks as mb}
      {#if mb}
        <div class="block bg-white/20 border border-white/30" style="left: {minutesToX(blockToMins(mb).s)}px; width: {minutesToX(blockToMins(mb).e - blockToMins(mb).s)}px;">
          <div class="handle absolute left-0 top-0 bottom-0" on:pointerdown={(e)=>{ const m=blockToMins(mb); startResize(mb.id,'start',e,m.s,m.e); }}></div>
          <div class="handle absolute right-0 top-0 bottom-0" on:pointerdown={(e)=>{ const m=blockToMins(mb); startResize(mb.id,'end',e,m.s,m.e); }}></div>
          <button class="absolute -top-2 -right-2 text-xs bg-red-600 text-white rounded px-1" on:click={() => del(mb.id)}>✕</button>
        </div>
      {/if}
    {/each}

    {#if dragging && dragging.type==='create'}
      <div class="block bg-blue-500/40 border border-blue-400/50" style="left: {minutesToX(Math.min(dragging.startMin, dragging.endMin))}px; width: {minutesToX(Math.abs(dragging.endMin - dragging.startMin))}px;"></div>
    {/if}
  </div>

  <div class="mt-1 opacity-60">Hover: {Math.floor(hoverMin/60)}:{String(hoverMin%60).padStart(2,'0')}</div>
</div>


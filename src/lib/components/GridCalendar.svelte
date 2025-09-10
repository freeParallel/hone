<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let start_date: string;
  export let end_date: string;
  export let duration: number = 60; // minutes; determines slot size
  export let myBlocks: { id: string; start_ts: string; end_ts: string }[] = [];
  export let otherBlocks: { id: string; start_ts: string; end_ts: string }[] = [];
  export let disabled = false;

  const dispatch = createEventDispatcher();

  function dateRange(start: string, end: string) {
    const days: string[] = [];
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }

  const days = dateRange(start_date, end_date);
  const slotsPerDay = Math.ceil(1440 / duration);
  function slotLabel(i: number) {
    const minutes = i * duration;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  function isoAt(day: string, minutes: number) {
    const d = new Date(day + 'T00:00:00');
    d.setMinutes(d.getMinutes() + minutes);
    return d.toISOString();
  }

  function onCellClick(day: string, slotIndex: number) {
    if (disabled) return;
    const startMin = slotIndex * duration;
    const endMin = startMin + duration;
    dispatch('add', { start: isoAt(day, startMin), end: isoAt(day, endMin) });
  }

  function minutesOfDay(iso: string) {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes();
  }

  function cellSpan(b: { start_ts: string; end_ts: string }) {
    const s = minutesOfDay(b.start_ts);
    const e = minutesOfDay(b.end_ts);
    const startIdx = Math.floor(s / duration);
    const span = Math.max(1, Math.round((e - s) / duration));
    return { startIdx, span };
  }
</script>

<style>
  .gridcal { display: grid; grid-template-columns: 100px repeat(var(--cols), 1fr); }
  .daycol { position: relative; }
  .block { position: absolute; left: 4px; right: 4px; border-radius: 6px; padding: 2px 4px; font-size: 12px; }
</style>

<div class="gridcal text-white" style={`--cols:${days.length}`}> 
  <!-- Time column -->
  <div class="pr-2">
    <div class="h-8"></div>
    {#each Array(slotsPerDay) as _, i}
      <div class="h-8 border-t border-neutral-800 opacity-70">{slotLabel(i)}</div>
    {/each}
  </div>

  {#each days as day}
    <div class="daycol">
      <div class="h-8 border-b border-neutral-800 font-semibold">{day}</div>
      {#each Array(slotsPerDay) as _, i}
        <div class="h-8 border-t border-neutral-800 hover:bg-neutral-800/70 cursor-pointer" on:click={() => onCellClick(day, i)}></div>
      {/each}

      <!-- other blocks -->
      {#each otherBlocks as ob}
        {#if ob && ob.start_ts.slice(0,10) === day}
          <div class="block bg-neutral-700/50" style={`top:${cellSpan(ob).startIdx*32+8}px; height:${cellSpan(ob).span*32 - 6}px`}></div>
        {/if}
      {/each}

      <!-- my blocks (click to delete) -->
      {#each myBlocks as mb}
        {#if mb && mb.start_ts.slice(0,10) === day}
          <div class="block bg-blue-500/40 border border-blue-400/50" style={`top:${cellSpan(mb).startIdx*32+8}px; height:${cellSpan(mb).span*32 - 6}px`} on:click={() => dispatch('delete', { id: mb.id })}></div>
        {/if}
      {/each}
    </div>
  {/each}
</div>


<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';

  export let duration: number = 60; // minutes; determines slot size
  export let myBlocks: { id: string; start_ts: string; end_ts: string }[] = [];
  export let otherBlocks: { id: string; start_ts: string; end_ts: string }[] = [];
  export let disabled = false;

  const dispatch = createEventDispatcher();

  // Layout constants
  const SLOT_PX = 47; // pixel height per slot (≈30% increase from original 36px)
  const HEADER_PX = 40; // day header height in px
  let visibleHours = 8; // hours visible without scrolling (user-adjustable)

  let scrollEl: HTMLDivElement | null = null;
  let now: Date = new Date();
  function updateNow() { now = new Date(); }

  // Derived values
  $: visibleHeightPx = HEADER_PX + visibleHours * (60 / duration) * SLOT_PX;
  $: nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Week navigation state
  let currentWeekStart = new Date();
  let eraseMode = false;
  let dragStart: { day: string; slot: number } | null = null;
  let dragCurrent: { day: string; slot: number } | null = null;
  let isDragging = false;

  // Initialize to start of current week (Monday)
  function getWeekStart(date: Date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function initializeWeek() {
    currentWeekStart = getWeekStart();
  }

  onMount(() => {
    initializeWeek();
    // keep current time fresh
    const id = setInterval(updateNow, 60_000);
    updateNow();
    // center on now after mount
    setTimeout(() => centerOnNow(true), 0);
    return () => clearInterval(id);
  });

  // Generate 7 days (1 week) from current week start
  $: days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  // Navigation functions
  function goToToday() {
    currentWeekStart = getWeekStart();
    setTimeout(() => centerOnNow(true), 0);
  }

  function prevWeek() {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    currentWeekStart = newStart;
  }

  function nextWeek() {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    currentWeekStart = newStart;
  }

  // Time slots: full day (00:00 - 24:00)
  const startHour = 0;
  const endHour = 23;
  const totalHours = endHour - startHour + 1; // 24 hours
  const slotsPerHour = 60 / duration;
  const totalSlots = Math.ceil(totalHours * slotsPerHour);

  function slotToTime(slotIndex: number): { hour: number; minute: number } {
    const totalMinutes = startHour * 60 + slotIndex * duration;
    return {
      hour: Math.floor(totalMinutes / 60),
      minute: totalMinutes % 60
    };
  }

  function slotLabel(i: number) {
    const { hour, minute } = slotToTime(i);
    return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  }

  function shouldLabelSlot(i: number) {
    const { minute } = slotToTime(i);
    return minute === 0; // show only on the hour
  }

  function isoAt(day: string, slotIndex: number) {
    const { hour, minute } = slotToTime(slotIndex);
    const d = new Date(day + 'T00:00:00');
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  }

  function isQuietHour(slotIndex: number): boolean {
    const { hour } = slotToTime(slotIndex);
    return hour < 7 || hour >= 22;
  }

  // Drag handling
  function onCellMouseDown(day: string, slotIndex: number, event: MouseEvent) {
    if (disabled) return;
    event.preventDefault();
    dragStart = { day, slot: slotIndex };
    dragCurrent = { day, slot: slotIndex };
    isDragging = true;
  }

  function onCellMouseEnter(day: string, slotIndex: number) {
    if (isDragging && dragStart) {
      dragCurrent = { day, slot: slotIndex };
    }
  }

  function onMouseUp() {
    if (!isDragging || !dragStart || !dragCurrent) return;
    
    if (eraseMode) {
      // Find and delete blocks in the dragged area
      const blocks = getBlocksInDragArea(dragStart, dragCurrent);
      blocks.forEach(block => {
        dispatch('delete', { id: block.id });
      });
    } else {
      // Add new block(s)
      const newBlocks = getNewBlocksFromDrag(dragStart, dragCurrent);
      newBlocks.forEach(block => {
        dispatch('add', block);
      });
    }
    
    dragStart = null;
    dragCurrent = null;
    isDragging = false;
  }

  function getNewBlocksFromDrag(start: { day: string; slot: number }, end: { day: string; slot: number }) {
    const blocks = [];
    const dayStart = days.indexOf(start.day);
    const dayEnd = days.indexOf(end.day);
    const slotStart = Math.min(start.slot, end.slot);
    const slotEnd = Math.max(start.slot, end.slot);

    for (let dayIdx = Math.min(dayStart, dayEnd); dayIdx <= Math.max(dayStart, dayEnd); dayIdx++) {
      for (let slot = slotStart; slot <= slotEnd; slot++) {
        blocks.push({
          start: isoAt(days[dayIdx], slot),
          end: isoAt(days[dayIdx], slot + 1)
        });
      }
    }
    return blocks;
  }

  function getBlocksInDragArea(start: { day: string; slot: number }, end: { day: string; slot: number }) {
    // Find myBlocks that intersect with the drag area
    return myBlocks.filter(block => {
      const blockDay = block.start_ts.slice(0, 10);
      const blockSlot = timeToSlot(block.start_ts);
      return isInDragArea(blockDay, blockSlot, start, end);
    });
  }

  function isInDragArea(day: string, slot: number, start: { day: string; slot: number }, end: { day: string; slot: number }) {
    const dayIdx = days.indexOf(day);
    const startDayIdx = days.indexOf(start.day);
    const endDayIdx = days.indexOf(end.day);
    const slotStart = Math.min(start.slot, end.slot);
    const slotEnd = Math.max(start.slot, end.slot);
    
    return dayIdx >= Math.min(startDayIdx, endDayIdx) && 
           dayIdx <= Math.max(startDayIdx, endDayIdx) &&
           slot >= slotStart && slot <= slotEnd;
  }

  function timeToSlot(isoTime: string): number {
    const d = new Date(isoTime);
    const totalMinutes = d.getHours() * 60 + d.getMinutes();
    const slotMinutes = totalMinutes - (startHour * 60);
    return Math.floor(slotMinutes / duration);
  }

  function minutesOfDay(iso: string) {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes();
  }

  function cellSpan(b: { start_ts: string; end_ts: string }) {
    const startSlot = timeToSlot(b.start_ts);
    const endSlot = timeToSlot(b.end_ts);
    const span = Math.max(1, endSlot - startSlot);
    return { startIdx: startSlot, span };
  }

  function formatDayHeader(dayStr: string) {
    const date = new Date(dayStr + 'T00:00:00');
    const dayName = date.toLocaleDateString('en', { weekday: 'short' });
    const dayNum = date.getDate();
    const monthName = date.toLocaleDateString('en', { month: 'short' });
    return { dayName, dayNum, monthName };
  }

  function isToday(dayStr: string) {
    return dayStr === new Date().toISOString().slice(0, 10);
  }
  function isPastDay(dayStr: string) {
    return dayStr < new Date().toISOString().slice(0, 10);
  }

  // Drag preview areas
  $: dragPreview = isDragging && dragStart && dragCurrent ? {
    dayStart: Math.min(days.indexOf(dragStart.day), days.indexOf(dragCurrent.day)),
    dayEnd: Math.max(days.indexOf(dragStart.day), days.indexOf(dragCurrent.day)),
    slotStart: Math.min(dragStart.slot, dragCurrent.slot),
    slotEnd: Math.max(dragStart.slot, dragCurrent.slot)
  } : null;
  function centerOnNow(smooth: boolean = true) {
    if (!scrollEl) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    if (!days.includes(todayStr)) return;
    const contentHeight = HEADER_PX + totalSlots * SLOT_PX;
    const visibleScrollable = visibleHeightPx - HEADER_PX;
    const nowTop = HEADER_PX + (nowMinutes / duration) * SLOT_PX;
    const target = Math.max(0, Math.min(contentHeight - visibleHeightPx, nowTop - visibleScrollable / 2));
    try {
      scrollEl.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'auto' });
    } catch {
      scrollEl.scrollTop = target;
    }
  }
</script>

<style>
  .calendar-wrapper { color: white; }
  .toolbar { position: sticky; top: 0; z-index: 10; background: #000; padding: 8px 0; }
.gridcal { border: 1px solid #262626; border-radius: 10px; overflow-x: auto; overflow-y: hidden; background: #0a0a0a; }
  .scroll { display: grid; grid-template-columns: 90px repeat(var(--cols), minmax(var(--day-min-w), 1fr)); position: relative; overflow-y: auto; }
  .timecol { position: sticky; left: 0; background: #0a0a0a; z-index: 5; border-right: 1px solid #262626; }
  .timecell { height: var(--slot-h); border-top: 1px dashed #262626; opacity: 0.8; padding-right: 8px; display:flex; align-items:center; justify-content:flex-end; font-size: 12px; }
  .daycol { position: relative; background: #0a0a0a; }
  .dayheader { position: sticky; top: 0; z-index: 6; background: #0a0a0a; border-bottom: 1px solid #262626; height: 44px; padding-top: 2px; display:flex; align-items:center; justify-content:center; font-weight: 600; font-size: 14px; }
  .cell { height: var(--slot-h); border-top: 1px solid #111; border-bottom: 1px solid #111; border-left: 1px solid #111; }
  .cell:hover { background: rgba(255,255,255,0.06); }
  .block { position: absolute; left: 4px; right: 4px; border-radius: 6px; padding: 2px 4px; font-size: 12px; z-index: 3; }
  .quiet { background: rgba(255,255,255,0.04); position: absolute; left: 0; right: 0; pointer-events: none; z-index: 1; }
  .pastmask { position: absolute; left: 0; right: 0; pointer-events: none; z-index: 2; background: repeating-linear-gradient(45deg, rgba(160,160,160,0.12) 0px, rgba(160,160,160,0.12) 8px, rgba(160,160,160,0.06) 8px, rgba(160,160,160,0.06) 16px); }
  .today { outline: 2px solid rgba(255,255,255,0.1); outline-offset: -2px; }
  .dragmask { position: absolute; left: 0; right: 0; background: rgba(59,130,246,0.2); border: 1px solid rgba(59,130,246,0.4); pointer-events: none; z-index: 4; }
  .nowline { position: absolute; left: 0; right: 0; height: 2px; background: #ef4444; box-shadow: 0 0 0 1px rgba(239,68,68,0.25); z-index: 5; }
</style>

<svelte:window on:mouseup={onMouseUp} />
  <div class="calendar-wrapper">
  <div class="toolbar flex items-center justify-between gap-3">
    <div class="flex items-center gap-2">
      <button class="px-2 py-1 rounded border border-neutral-700 hover:bg-neutral-800" on:click={prevWeek}>‹ Prev</button>
      <button class="px-2 py-1 rounded border border-neutral-700 hover:bg-neutral-800" on:click={goToToday}>Today</button>
      <button class="px-2 py-1 rounded border border-neutral-700 hover:bg-neutral-800" on:click={() => centerOnNow(true)}>Center now</button>
      <button class="px-2 py-1 rounded border border-neutral-700 hover:bg-neutral-800" on:click={nextWeek}>Next ›</button>
    </div>
    <div class="flex items-center gap-3 text-sm">
      <div class="flex items-center gap-2">
        <span class="opacity-70">Visible:</span>
        <button class={`px-2 py-1 rounded border ${visibleHours===6 ? 'bg-white text-black border-white' : 'border-neutral-700 hover:bg-neutral-800'}`} on:click={() => visibleHours = 6}>6h</button>
        <button class={`px-2 py-1 rounded border ${visibleHours===8 ? 'bg-white text-black border-white' : 'border-neutral-700 hover:bg-neutral-800'}`} on:click={() => visibleHours = 8}>8h</button>
        <button class={`px-2 py-1 rounded border ${visibleHours===10 ? 'bg-white text-black border-white' : 'border-neutral-700 hover:bg-neutral-800'}`} on:click={() => visibleHours = 10}>10h</button>
      </div>
      <label class="flex items-center gap-1"><input type="checkbox" bind:checked={eraseMode} /> Erase</label>
    </div>
  </div>

  <div class="gridcal">
    <div class="scroll" bind:this={scrollEl} style={`--cols:${days.length}; height:${visibleHeightPx}px; --slot-h:${SLOT_PX}px; --day-min-w: 140px`}>
      <!-- Time column -->
      <div class="timecol">
        <div class="dayheader"></div>
        {#each Array(totalSlots) as _, i}
          <div class="timecell">{#if shouldLabelSlot(i)}{slotLabel(i)}{/if}</div>
        {/each}
      </div>

      {#each days as day}
        {#key day}
        <div class="daycol {isToday(day) ? 'today' : ''}">
          <!-- Day header -->
          <div class="dayheader">
            <div class="text-center">
              <div class="text-xs opacity-70">{formatDayHeader(day).monthName}</div>
              <div>{formatDayHeader(day).dayName} <span class="opacity-70">{formatDayHeader(day).dayNum}</span></div>
            </div>
          </div>

          <!-- Cells -->
          {#each Array(totalSlots) as _, i}
            <div class="cell cursor-pointer"
                role="button"
                tabindex="0"
                aria-label={`Select ${day} ${slotLabel(i)}`}
                on:mousedown={(e) => onCellMouseDown(day, i, e)}
                on:mouseenter={() => onCellMouseEnter(day, i)}
                on:keydown={(e) => { if (e.key==='Enter' || e.key===' ') { e.preventDefault(); dispatch('add', { start: isoAt(day, i), end: isoAt(day, i+1) }); } }}>
            </div>
          {/each}

          <!-- Quiet hours shading (00–07 and 22–24) over full 24h -->
          {#each Array(totalSlots) as _, i}
            {#if isQuietHour(i)}
              <div class="quiet" style={`top:${HEADER_PX + i*SLOT_PX}px; height:${SLOT_PX}px`}></div>
            {/if}
          {/each}

          <!-- Past time hatch (non-eligible: past days, or earlier today) -->
          {#if isPastDay(day)}
            <div class="pastmask" style={`top:${HEADER_PX}px; height:${totalSlots*SLOT_PX}px`}></div>
          {:else if isToday(day)}
            <div class="pastmask" style={`top:${HEADER_PX}px; height:${(nowMinutes / duration) * SLOT_PX}px`}></div>
          {/if}

          <!-- other blocks -->
          {#each otherBlocks as ob}
            {#if ob && ob.start_ts.slice(0,10) === day}
              <div class="block bg-neutral-700/50" style={`top:${HEADER_PX + cellSpan(ob).startIdx*SLOT_PX}px; height:${cellSpan(ob).span*SLOT_PX - 6}px`}></div>
            {/if}
          {/each}

          <!-- my blocks (click to delete) -->
          {#each myBlocks as mb}
            {#if mb && mb.start_ts.slice(0,10) === day}
              <div class="block bg-blue-500/40 border border-blue-400/50" style={`top:${HEADER_PX + cellSpan(mb).startIdx*SLOT_PX}px; height:${cellSpan(mb).span*SLOT_PX - 6}px`} role="button" tabindex="0" on:click={() => dispatch('delete', { id: mb.id })} on:keydown={(e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); dispatch('delete', { id: mb.id }); } }}></div>
            {/if}
          {/each}

          <!-- current time line (only on today) -->
          {#if isToday(day)}
            <div class="nowline" style={`top:${HEADER_PX + (nowMinutes / duration) * SLOT_PX}px`}></div>
          {/if}

          {#if dragPreview && days.indexOf(day) >= dragPreview.dayStart && days.indexOf(day) <= dragPreview.dayEnd}
            <div class="dragmask" style={`top:${HEADER_PX + dragPreview.slotStart*SLOT_PX}px; height:${(dragPreview.slotEnd - dragPreview.slotStart + 1)*SLOT_PX - 2}px`}></div>
          {/if}
        </div>
        {/key}
      {/each}
    </div>
  </div>
</div>


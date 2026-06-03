<script lang="ts">
  import { onMount } from 'svelte';
  import { activities, calendarEvents, refreshActivities, refreshCalendar, refreshActions, flashToast } from '$lib/stores.js';
  import { todayIso } from '$lib/format.js';
  import { ALL_TYPES, TYPE_LABELS } from '$lib/activityTypes.js';
  import type { ActivityType, CalendarEvent, CalendarEventKind } from '$lib/types.js';
  const KIND_LABELS: Record<CalendarEventKind, string> = {
    BOOKING: 'Booking', MAINTENANCE: 'Maintenance', REMINDER: 'Reminder', OTHER: 'Other'
  };
  const ALL_KINDS: CalendarEventKind[] = ['BOOKING', 'MAINTENANCE', 'REMINDER', 'OTHER'];
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const today = new Date();
  let viewYear  = today.getFullYear();
  let viewMonth = today.getMonth();

  let selectedTypes: Set<ActivityType> = new Set(ALL_TYPES);
  let pickedIds: Set<number> = new Set();
  let view: 'grid' | 'list' = 'grid';

  function toggleType(t: ActivityType) {
    const next = new Set(selectedTypes);
    if (next.has(t)) next.delete(t); else next.add(t);
    selectedTypes = next;
  }
  function togglePick(id: number) {
    const next = new Set(pickedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    pickedIds = next;
  }
  function clearPicks() { pickedIds = new Set(); }

  $: gridStart = (() => {
    const first = new Date(Date.UTC(viewYear, viewMonth, 1));
    const start = new Date(first);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    return start;
  })();
  $: gridEnd = (() => {
    const end = new Date(gridStart);
    end.setUTCDate(end.getUTCDate() + 41);
    return end;
  })();
  $: cells = (() => {
    const out: { date: Date; iso: string; inMonth: boolean; isToday: boolean }[] = [];
    const todayIsoStr = todayIso();
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setUTCDate(d.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      out.push({
        date: d,
        iso,
        inMonth: d.getUTCMonth() === viewMonth,
        isToday: iso === todayIsoStr
      });
    }
    return out;
  })();

  $: fromIso = gridStart.toISOString().slice(0, 10);
  $: toIso = gridEnd.toISOString().slice(0, 10);
  $: refreshCalendar(fromIso, toIso);

  $: visibleActivities = $activities.filter((a) =>
    pickedIds.size > 0 ? pickedIds.has(a.id) : selectedTypes.has(a.type)
  );
  $: visibleIdSet = new Set(visibleActivities.map((a) => a.id));
  $: activityById = new Map($activities.map((a) => [a.id, a]));

  $: visibleEvents = $calendarEvents.filter((e) => visibleIdSet.has(e.activity_id));

  function eventsForDay(iso: string): CalendarEvent[] {
    return visibleEvents.filter((e) => {
      const end = e.end_date ?? e.start_date;
      return e.start_date <= iso && iso <= end;
    }).sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id);
  }

  $: monthName = new Date(Date.UTC(viewYear, viewMonth, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  function prevMonth() {
    if (viewMonth === 0) { viewMonth = 11; viewYear -= 1; }
    else viewMonth -= 1;
  }
  function nextMonth() {
    if (viewMonth === 11) { viewMonth = 0; viewYear += 1; }
    else viewMonth += 1;
  }
  function goToday() {
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
  }

  let showForm = false;
  let editingId: number | null = null;
  let formActivityId: number | null = null;
  let formTitle = '';
  let formKind: CalendarEventKind = 'BOOKING';
  let formStart = '';
  let formEnd = '';
  let formNotes = '';

  function openCreate(iso: string) {
    if (visibleActivities.length === 0) {
      flashToast('Create an activity first');
      return;
    }
    editingId = null;
    formActivityId = visibleActivities[0].id;
    const a = activityById.get(formActivityId);
    formKind = a?.type === 'AIRBNB' || a?.type === 'TURO' ? 'BOOKING' : 'OTHER';
    formTitle = '';
    formStart = iso;
    formEnd = '';
    formNotes = '';
    showForm = true;
  }

  function openEdit(e: CalendarEvent) {
    editingId = e.id;
    formActivityId = e.activity_id;
    formTitle = e.title;
    formKind = e.kind;
    formStart = e.start_date;
    formEnd = e.end_date ?? '';
    formNotes = e.notes;
    showForm = true;
  }

  async function save() {
    if (formActivityId == null) return;
    const body = {
      activity_id: formActivityId,
      title: formTitle,
      kind: formKind,
      start_date: formStart,
      end_date: formEnd || null,
      notes: formNotes
    };
    if (editingId == null) {
      await fetch('/api/calendar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      flashToast('Event added');
    } else {
      await fetch(`/api/calendar/${editingId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      flashToast('Event updated');
    }
    showForm = false;
    await refreshCalendar(fromIso, toIso);
    await refreshActions();
  }

  async function remove() {
    if (editingId == null) return;
    if (!confirm('Delete this event? (You can undo.)')) return;
    await fetch(`/api/calendar/${editingId}`, { method: 'DELETE' });
    flashToast('Event deleted');
    showForm = false;
    await refreshCalendar(fromIso, toIso);
    await refreshActions();
  }

  function exportIcs() {
    const ids = pickedIds.size > 0
      ? [...pickedIds]
      : visibleActivities.map((a) => a.id);
    const qs = ids.length > 0 ? `?activity_ids=${ids.join(',')}` : '';
    window.location.href = `/api/calendar/ics${qs}`;
  }

  $: listEventsInRange = (() => {
    return visibleEvents
      .filter((e) => {
        const end = e.end_date ?? e.start_date;
        return e.start_date <= toIso && end >= fromIso;
      })
      .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id);
  })();

  onMount(() => { refreshActivities(); });
</script>

<section class="section-header">
  <h2>Calendar</h2>
  <div class="row right" style="gap: 0.3rem;">
    <button on:click={prevMonth} title="Previous month">‹</button>
    <button on:click={goToday}>Today</button>
    <button on:click={nextMonth} title="Next month">›</button>
    <button on:click={() => (view = view === 'grid' ? 'list' : 'grid')}>
      {view === 'grid' ? 'List view' : 'Grid view'}
    </button>
    <button on:click={exportIcs} title="Download .ics for Proton Calendar / iCal / Google">⬇ .ics</button>
  </div>
</section>

<h3 style="margin: 0 0 1rem; font-weight: 500;">{monthName}</h3>

<div class="filter-bar">
  {#each ALL_TYPES as t}
    <button
      class="filter-chip"
      class:on={selectedTypes.has(t)}
      on:click={() => toggleType(t)}
      disabled={pickedIds.size > 0}
    >{TYPE_LABELS[t]}</button>
  {/each}
  {#if pickedIds.size > 0}
    <button class="filter-chip on" on:click={clearPicks}>{pickedIds.size} picked — clear</button>
  {/if}
</div>

{#if visibleActivities.length > 0}
  <div class="filter-bar" style="font-size: 0.85rem;">
    <span class="muted" style="margin-right: 0.4rem; align-self: center;">Activities:</span>
    {#each visibleActivities as a}
      <button
        class="filter-chip"
        class:on={pickedIds.has(a.id)}
        on:click={() => togglePick(a.id)}
        style="border-color: {a.color}; {pickedIds.has(a.id) ? `background: ${a.color}; color: white;` : ''}"
      >
        <span class="color-dot" style="background: {a.color}; margin-right: 0.3rem;"></span>{a.name}
      </button>
    {/each}
  </div>
{/if}

{#if view === 'grid'}
  <div class="cal-grid">
    {#each WEEKDAYS as w}
      <div class="cal-day-header">{w}</div>
    {/each}
    {#each cells as cell (cell.iso)}
      {@const dayEvents = eventsForDay(cell.iso)}
      <div
        class="cal-cell"
        class:dim={!cell.inMonth}
        class:today={cell.isToday}
        on:click={() => openCreate(cell.iso)}
        on:keydown={(e) => (e.key === 'Enter' ? openCreate(cell.iso) : null)}
        role="button"
        tabindex="0"
      >
        <div class="cal-day-num">{cell.date.getUTCDate()}</div>
        {#each dayEvents as e (e.id)}
          {@const color = activityById.get(e.activity_id)?.color ?? '#3b82f6'}
          <div
            class="cal-event"
            style="background: {color};"
            on:click|stopPropagation={() => openEdit(e)}
            on:keydown|stopPropagation={(ev) => (ev.key === 'Enter' ? openEdit(e) : null)}
            role="button"
            tabindex="0"
            title="{e.title} ({KIND_LABELS[e.kind]})"
          >{e.title}</div>
        {/each}
      </div>
    {/each}
  </div>
{:else}
  {#if listEventsInRange.length === 0}
    <div class="card"><p class="muted">No events in {monthName}.</p></div>
  {:else}
    <div class="card" style="padding: 0;">
      <table class="table">
        <thead>
          <tr><th>Date</th><th>Activity</th><th>Title</th><th>Kind</th><th></th></tr>
        </thead>
        <tbody>
          {#each listEventsInRange as e (e.id)}
            {@const a = activityById.get(e.activity_id)}
            <tr>
              <td>{e.start_date}{e.end_date && e.end_date !== e.start_date ? ' → ' + e.end_date : ''}</td>
              <td><span class="color-dot" style="background: {a?.color};"></span> {a?.name ?? ''}</td>
              <td>{e.title}</td>
              <td><span class="chip">{KIND_LABELS[e.kind]}</span></td>
              <td style="text-align: right;"><button on:click={() => openEdit(e)}>Edit</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/if}

{#if showForm}
  <div class="modal-bg" on:click|self={() => (showForm = false)} role="dialog">
    <div class="modal">
      <h3>{editingId == null ? 'New event' : 'Edit event'}</h3>
      <div class="col">
        <div>
          <label>Activity</label>
          <select bind:value={formActivityId}>
            {#each $activities as a}<option value={a.id}>{a.name}</option>{/each}
          </select>
        </div>
        <div>
          <label>Kind</label>
          <select bind:value={formKind}>
            {#each ALL_KINDS as k}<option value={k}>{KIND_LABELS[k]}</option>{/each}
          </select>
        </div>
        <div>
          <label>Title</label>
          <input bind:value={formTitle} placeholder="e.g. Smith family checkin" />
        </div>
        <div class="row" style="gap: 0.5rem;">
          <div class="grow">
            <label>Start date</label>
            <input type="date" bind:value={formStart} />
          </div>
          <div class="grow">
            <label>End date <span class="muted">(optional)</span></label>
            <input type="date" bind:value={formEnd} />
          </div>
        </div>
        <div>
          <label>Notes</label>
          <textarea bind:value={formNotes} rows="2" placeholder="optional"></textarea>
        </div>
        <div class="row" style="margin-top: 0.5rem;">
          {#if editingId != null}
            <button class="danger" on:click={remove}>Delete</button>
          {/if}
          <button class="right" on:click={() => (showForm = false)}>Cancel</button>
          <button class="primary" on:click={save} disabled={!formTitle.trim() || !formStart}>Save</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .cal-day-header {
    background: var(--bg-2);
    padding: 0.4rem;
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .cal-cell {
    background: var(--bg);
    min-height: 5.5rem;
    padding: 0.3rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    transition: background 0.1s;
  }
  .cal-cell:hover { background: var(--bg-3); }
  .cal-cell.dim { opacity: 0.45; }
  .cal-cell.today { background: rgba(59, 130, 246, 0.15); }
  .cal-day-num {
    font-size: 0.8rem;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }
  .cal-event {
    font-size: 0.72rem;
    padding: 0.12rem 0.4rem;
    border-radius: 3px;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    font-weight: 500;
  }
  .cal-event:hover { filter: brightness(1.15); }
  @media (max-width: 640px) {
    .cal-cell { min-height: 3.5rem; padding: 0.15rem; }
    .cal-event { font-size: 0.65rem; padding: 0.05rem 0.25rem; }
    .cal-day-num { font-size: 0.7rem; }
  }
</style>

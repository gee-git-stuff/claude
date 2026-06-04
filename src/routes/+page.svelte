<script lang="ts">
  import { onMount } from 'svelte';
  import { activities, totals, entries, charts, refreshActivities, refreshActions, refreshCharts, refreshEntries, flashToast } from '$lib/stores.js';
  import { CATEGORIES, PERSONAL_CATEGORIES, formatMoney, formatDate, parseMoney, todayIso } from '$lib/format.js';
  import { categoryDoughnutData, moneyAxis, moneyTooltip, netOverTimeData, profitabilityBarData } from '$lib/chartHelpers.js';
  import { ALL_TYPES, TYPE_LABELS } from '$lib/activityTypes.js';
  import Chart from '$lib/components/Chart.svelte';
  import type { ActivityType, EntryKind, EntryWithRecurrence, RecurrenceFrequency } from '$lib/types.js';

  let selectedIds: Set<number> = new Set();
  let expanded:    Set<number> = new Set();
  let filterOpen = true;
  let itemSearch = '';
  type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'category';
  let entrySort: SortKey = 'date_desc';
  let months = 12;
  let initialized = false;

  const TIME_RANGES = [
    { value: 3,  label: '3 mo' },
    { value: 6,  label: '6 mo' },
    { value: 12, label: '1 yr' },
    { value: 24, label: '2 yr' },
    { value: 60, label: '5 yr' }
  ];

  onMount(async () => {
    await refreshActivities();
    await refreshEntries();
    await refreshCharts(months);
  });
  $: refreshCharts(months);

  // First time activities load, select them all so the page isn't empty.
  $: if (!initialized && $activities.length > 0) {
    selectedIds = new Set($activities.map((a) => a.id));
    initialized = true;
  }

  function activitiesOfType(t: ActivityType) {
    return $activities.filter((a) => a.type === t);
  }

  function allOfTypeSelected(t: ActivityType): boolean {
    const list = activitiesOfType(t);
    return list.length > 0 && list.every((a) => selectedIds.has(a.id));
  }

  function someOfTypeSelected(t: ActivityType): boolean {
    const list = activitiesOfType(t);
    return list.some((a) => selectedIds.has(a.id));
  }

  function toggleType(t: ActivityType) {
    const list = activitiesOfType(t);
    const all = allOfTypeSelected(t);
    const next = new Set(selectedIds);
    if (all) for (const a of list) next.delete(a.id);
    else     for (const a of list) next.add(a.id);
    selectedIds = next;
  }

  function toggleActivity(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    selectedIds = next;
  }

  function selectAll() { selectedIds = new Set($activities.map((a) => a.id)); }
  function clearAll()  { selectedIds = new Set(); }

  function toggleExpanded(id: number) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    expanded = next;
  }
  function expandAll()   { expanded = new Set(selectedIds); }
  function collapseAll() { expanded = new Set(); }

  $: visibleActivities = $activities.filter((a) => selectedIds.has(a.id));
  $: totalsById = Object.fromEntries($totals.map((t) => [t.activity_id, t]));

  $: combined = visibleActivities.reduce(
    (acc, a) => {
      const t = totalsById[a.id];
      if (t) { acc.expense += t.expense_cents; acc.income += t.income_cents; acc.net += t.net_cents; }
      return acc;
    },
    { expense: 0, income: 0, net: 0 }
  );

  $: entriesByActivity = (() => {
    const map = new Map<number, EntryWithRecurrence[]>();
    for (const e of $entries) {
      const list = map.get(e.activity_id) ?? [];
      list.push(e);
      map.set(e.activity_id, list);
    }
    return map;
  })();

  function sortEntries(list: EntryWithRecurrence[], by: SortKey): EntryWithRecurrence[] {
    const copy = [...list];
    switch (by) {
      case 'date_desc':    copy.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id); break;
      case 'date_asc':     copy.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id); break;
      case 'amount_desc':  copy.sort((a, b) => b.amount_cents - a.amount_cents); break;
      case 'category':     copy.sort((a, b) => a.category.localeCompare(b.category) || b.date.localeCompare(a.date)); break;
    }
    return copy;
  }

  $: filteredItems = (() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return $activities;
    return $activities.filter((a) => a.name.toLowerCase().includes(q));
  })();

  let showAdd = false;
  let addActivityId: number | null = null;
  let addKind: EntryKind = 'EXPENSE';
  let addAmount = '';
  let addDate = todayIso();
  let addCategory = 'Other';
  let addNote = '';
  let addRecurring = false;
  let addFreq: RecurrenceFrequency = 'MONTHLY';
  let addInterval = 1;
  let addEnd = '';

  function openAdd(activityId: number, kind: EntryKind) {
    addActivityId = activityId;
    addKind = kind;
    addAmount = '';
    addDate = todayIso();
    const a = $activities.find((x) => x.id === activityId);
    const base = a?.type === 'PERSONAL' ? PERSONAL_CATEGORIES : CATEGORIES;
    addCategory = kind === 'INCOME' ? (base.find((c) => c.toLowerCase().includes('income') || c.toLowerCase().includes('salary')) ?? base[0]) : base[0];
    addNote = '';
    addRecurring = false;
    addFreq = 'MONTHLY';
    addInterval = 1;
    addEnd = '';
    showAdd = true;
  }

  $: addCategoryOptions = (() => {
    const a = $activities.find((x) => x.id === addActivityId);
    return a?.type === 'PERSONAL' ? PERSONAL_CATEGORIES : CATEGORIES;
  })();

  async function saveAdd() {
    if (addActivityId == null || !addAmount.trim()) return;
    const body = {
      activity_id: addActivityId,
      kind: addKind,
      amount_cents: parseMoney(addAmount),
      date: addDate,
      category: addCategory,
      note: addNote,
      recurrence: addRecurring ? { frequency: addFreq, interval: addInterval, end_date: addEnd || null } : null
    };
    const r = await fetch('/api/entries', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!r.ok) { flashToast('Could not add'); return; }
    flashToast(`${addKind === 'EXPENSE' ? 'Expense' : 'Income'} added`);
    showAdd = false;
    await refreshEntries();
    await refreshActivities();
    await refreshActions();
    await refreshCharts(months);
  }

  $: chartsData = $charts;
  $: filteredMonthly = chartsData ? chartsData.monthly.filter((r) => selectedIds.has(r.activity_id)) : [];
  $: netLineData      = chartsData ? netOverTimeData(chartsData.labels, filteredMonthly, visibleActivities) : null;
  $: profitData       = chartsData ? profitabilityBarData(filteredMonthly, visibleActivities) : null;
  $: expenseDoughnut  = chartsData ? categoryDoughnutData(chartsData.categories, 'EXPENSE', selectedIds) : null;
</script>

<section class="section-header">
  <h2>Overview</h2>
  <span class="muted">{visibleActivities.length} of {$activities.length} items shown</span>
</section>

<section class="filter-panel">
  <button class="panel-toggle" on:click={() => (filterOpen = !filterOpen)}>
    <span style="width: 1rem;">{filterOpen ? '▾' : '▸'}</span>
    <span>Filter &amp; select</span>
    <span class="muted right" style="margin-left: auto;">
      {selectedIds.size === 0 ? 'nothing selected' : `${selectedIds.size} selected`}
    </span>
  </button>
  {#if filterOpen}
    <div class="panel-body">
      <div class="filter-group">
        <div class="filter-group-label">Select by type</div>
        <div class="chip-row">
          {#each ALL_TYPES as t}
            {@const count = activitiesOfType(t).length}
            {#if count > 0}
              {@const sel = allOfTypeSelected(t)}
              {@const partial = !sel && someOfTypeSelected(t)}
              <button
                class="select-chip"
                class:selected={sel}
                style={partial ? 'border-style: dashed; color: var(--text);' : ''}
                on:click={() => toggleType(t)}
                title={partial ? `${activitiesOfType(t).filter((a) => selectedIds.has(a.id)).length} of ${count} selected` : ''}
              >
                <span class="checkbox">{sel ? '✓' : (partial ? '–' : '')}</span>
                {TYPE_LABELS[t]}
                <span class="count">{count}</span>
              </button>
            {/if}
          {/each}
        </div>
      </div>

      <div class="filter-group">
        <div class="filter-group-label">Or pick individual items</div>
        {#if $activities.length === 0}
          <p class="muted" style="font-size: 0.9rem;">
            No activities yet. <a href="/activities">Create one →</a>
          </p>
        {:else}
          {#if $activities.length > 6}
            <div style="position: relative; max-width: 300px; margin-bottom: 0.5rem;">
              <input
                type="text"
                bind:value={itemSearch}
                placeholder="Search items by name…"
                style="padding-right: 1.8rem;"
              />
              {#if itemSearch}
                <button
                  on:click={() => (itemSearch = '')}
                  aria-label="Clear search"
                  style="position: absolute; right: 0.4rem; top: 50%; transform: translateY(-50%); padding: 0.15rem 0.4rem; background: transparent; border: none; color: var(--text-dim);"
                >×</button>
              {/if}
            </div>
          {/if}
          <div class="chip-row">
            {#each filteredItems as a (a.id)}
              {@const sel = selectedIds.has(a.id)}
              <button
                class="select-chip"
                class:selected={sel}
                style={sel ? `background: ${a.color}; border-color: ${a.color};` : `border-color: ${a.color};`}
                on:click={() => toggleActivity(a.id)}
              >
                <span class="checkbox">{sel ? '✓' : ''}</span>
                <span class="color-dot" style="background: {a.color}; opacity: {sel ? 0 : 1};"></span>
                {a.name}
              </button>
            {/each}
            {#if filteredItems.length === 0}
              <span class="muted" style="font-size: 0.85rem; padding: 0.4rem 0;">No items match "{itemSearch}".</span>
            {/if}
          </div>
          <div class="chip-row" style="margin-top: 0.5rem;">
            <button on:click={selectAll}>Select all</button>
            <button on:click={clearAll}>Clear</button>
          </div>
        {/if}
      </div>

      <div class="filter-group">
        <div class="filter-group-label">Time range (charts &amp; trends)</div>
        <div class="chip-row">
          {#each TIME_RANGES as r}
            <button class="select-chip" class:selected={months === r.value} on:click={() => (months = r.value)}>
              <span class="checkbox">{months === r.value ? '✓' : ''}</span>
              {r.label}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</section>

{#if visibleActivities.length === 0}
  <div class="card">
    <p class="muted" style="margin: 0;">
      {#if $activities.length === 0}
        No activities yet. <a href="/activities">Create your first one →</a>
      {:else}
        Nothing selected — pick types or individual items above.
      {/if}
    </p>
  </div>
{:else}
  <div class="card" style="margin-bottom: 0.75rem;">
    <div class="muted" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em;">
      Combined total — {visibleActivities.length} item{visibleActivities.length === 1 ? '' : 's'}
    </div>
    <div class="row" style="flex-wrap: wrap; gap: 1.5rem; margin-top: 0.4rem;">
      <div>
        <div class="muted">Income</div>
        <div class="amount good" style="font-size: 1.5rem;">{formatMoney(combined.income)}</div>
      </div>
      <div>
        <div class="muted">Expenses</div>
        <div class="amount bad" style="font-size: 1.5rem;">{formatMoney(combined.expense)}</div>
      </div>
      <div>
        <div class="muted">Net</div>
        <div class="amount {combined.net >= 0 ? 'good' : 'bad'}" style="font-size: 1.5rem;">{formatMoney(combined.net)}</div>
      </div>
    </div>
  </div>

  <div class="row" style="justify-content: flex-end; gap: 0.4rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
    <span class="muted" style="font-size: 0.85rem; align-self: center;">Sort entries:</span>
    <select bind:value={entrySort} style="width: auto;">
      <option value="date_desc">Newest first</option>
      <option value="date_asc">Oldest first</option>
      <option value="amount_desc">Largest amount</option>
      <option value="category">Category A–Z</option>
    </select>
    <button on:click={expandAll}   disabled={visibleActivities.length === 0 || expanded.size === visibleActivities.length}>Expand all</button>
    <button on:click={collapseAll} disabled={expanded.size === 0}>Collapse all</button>
  </div>

  {#each visibleActivities as a (a.id)}
    {@const t = totalsById[a.id] ?? { expense_cents: 0, income_cents: 0, net_cents: 0 }}
    {@const items = entriesByActivity.get(a.id) ?? []}
    {@const isExpanded = expanded.has(a.id)}
    <section class="activity-card" style="border-left-color: {a.color};">
      <button class="activity-header" on:click={() => toggleExpanded(a.id)} aria-expanded={isExpanded}>
        <span class="expand-arrow">{isExpanded ? '▾' : '▸'}</span>
        <span class="color-dot" style="background: {a.color};"></span>
        <span class="activity-name">{a.name}</span>
        <span class="chip type-chip" style="background: {a.color}40; color: {a.color}; border: 1px solid {a.color};">{TYPE_LABELS[a.type]}</span>
        <span class="header-stats">
          <span class="muted hide-narrow">+{formatMoney(t.income_cents)}</span>
          <span class="muted hide-narrow">−{formatMoney(t.expense_cents)}</span>
          <span class="amount {t.net_cents >= 0 ? 'good' : 'bad'}" style="font-weight: 600;">{formatMoney(t.net_cents)}</span>
        </span>
      </button>

      {#if isExpanded}
        {@const sorted = sortEntries(items, entrySort)}
        <div class="activity-body">
          <div class="row" style="gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; align-items: center;">
            <span class="muted" style="font-size: 0.85rem;">
              {items.length} {items.length === 1 ? 'entry' : 'entries'}
            </span>
            <div class="right row" style="gap: 0.3rem;">
              <button class="primary" on:click|stopPropagation={() => openAdd(a.id, 'EXPENSE')}>+ Expense</button>
              <button on:click|stopPropagation={() => openAdd(a.id, 'INCOME')}>+ Income</button>
              <a href="/activities/{a.id}" class="chip" style="text-decoration: none; padding: 0.35rem 0.7rem;">Detail →</a>
            </div>
          </div>
          {#if items.length === 0}
            <p class="muted" style="font-size: 0.9rem;">No entries yet for this item — use the buttons above to add one.</p>
          {:else}
            <div style="overflow-x: auto;">
              <table class="table compact-table">
                <thead>
                  <tr><th>Date</th><th>Category</th><th>Note</th><th style="text-align: right;">Amount</th></tr>
                </thead>
                <tbody>
                  {#each sorted.slice(0, 12) as e (e.id)}
                    <tr>
                      <td>{formatDate(e.date)}</td>
                      <td><span class="chip">{e.category || '—'}</span>{#if e.recurrence}<span class="chip" style="margin-left: 0.25rem;">↻</span>{/if}</td>
                      <td class="muted">{e.note}</td>
                      <td style="text-align: right;" class="amount {e.kind === 'INCOME' ? 'good' : 'bad'}">
                        {e.kind === 'INCOME' ? '+' : '−'}{formatMoney(e.amount_cents)}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
            {#if items.length > 12}
              <p class="muted" style="font-size: 0.8rem; text-align: center; margin: 0.4rem 0 0;">
                Showing 12 of {items.length} entries. <a href="/activities/{a.id}">View all →</a>
              </p>
            {/if}
          {/if}
        </div>
      {/if}
    </section>
  {/each}

  {#if chartsData}
    <section class="section-header" style="margin-top: 2rem;">
      <h2 style="font-size: 1.2rem;">Trends</h2>
      <span class="muted">last {months} {months === 1 ? 'month' : 'months'}</span>
    </section>
    <div class="grid" style="grid-template-columns: minmax(0, 1fr); gap: 1rem;">
      {#if netLineData}
        <div class="card">
          <div class="muted" style="margin-bottom: 0.5rem;">Net profit / loss per month</div>
          <Chart type="line" data={netLineData}
            options={{ plugins: { tooltip: moneyTooltip(), legend: { position: 'bottom' } }, scales: { y: moneyAxis() } }} />
        </div>
      {/if}
      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem;">
        {#if profitData}
          <div class="card">
            <div class="muted" style="margin-bottom: 0.5rem;">Profitability ranking</div>
            <Chart type="bar" data={profitData}
              options={{ indexAxis: 'y', plugins: { tooltip: moneyTooltip(), legend: { display: false } }, scales: { x: moneyAxis() } }} />
          </div>
        {/if}
        {#if expenseDoughnut && expenseDoughnut.labels.length > 0}
          <div class="card">
            <div class="muted" style="margin-bottom: 0.5rem;">Expenses by category</div>
            <Chart type="doughnut" data={expenseDoughnut}
              options={{ plugins: { tooltip: moneyTooltip(), legend: { position: 'right' } } }} />
          </div>
        {/if}
      </div>
    </div>
  {/if}
{/if}

{#if showAdd && addActivityId != null}
  {@const a = $activities.find((x) => x.id === addActivityId)}
  <div class="modal-bg" on:click|self={() => (showAdd = false)} role="dialog">
    <div class="modal">
      <h3 style="margin-top: 0;">
        Add {addKind === 'EXPENSE' ? 'expense' : 'income'} to
        <span style="color: {a?.color};">{a?.name}</span>
      </h3>
      <div class="col">
        <div>
          <label>Kind</label>
          <select bind:value={addKind}>
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </div>
        <div>
          <label>Amount (USD)</label>
          <input type="text" inputmode="decimal" bind:value={addAmount} placeholder="0.00" />
        </div>
        <div>
          <label>Date</label>
          <input type="date" bind:value={addDate} />
        </div>
        <div>
          <label>Category</label>
          <select bind:value={addCategory}>
            {#each addCategoryOptions as c}<option value={c}>{c}</option>{/each}
          </select>
        </div>
        <div>
          <label>Note</label>
          <input bind:value={addNote} placeholder="optional" />
        </div>
        <div>
          <label>
            <input type="checkbox" bind:checked={addRecurring} style="width: auto; margin-right: 0.4rem;" />
            Recurring
          </label>
        </div>
        {#if addRecurring}
          <div class="row" style="gap: 0.5rem;">
            <div class="grow">
              <label>Frequency</label>
              <select bind:value={addFreq}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL">Annual</option>
              </select>
            </div>
            <div style="width: 5.5rem;">
              <label>Every</label>
              <input type="number" min="1" bind:value={addInterval} />
            </div>
          </div>
          <div>
            <label>End date <span class="muted">(optional)</span></label>
            <input type="date" bind:value={addEnd} />
          </div>
        {/if}
        <div class="row" style="margin-top: 0.5rem;">
          <button on:click={() => (showAdd = false)}>Cancel</button>
          <button class="primary right" on:click={saveAdd} disabled={!addAmount.trim()}>Save</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .activity-card {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-left: 4px solid var(--accent);
    border-radius: var(--radius);
    margin-bottom: 0.55rem;
    overflow: hidden;
  }
  .activity-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.65rem 0.9rem;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    font: inherit;
    color: var(--text);
  }
  .activity-header:hover { background: var(--bg-3); }
  .expand-arrow {
    color: var(--text-dim);
    width: 1rem;
    text-align: center;
    flex-shrink: 0;
  }
  .activity-name {
    font-weight: 600;
  }
  .type-chip {
    border-radius: 999px;
    padding: 0.1rem 0.55rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .header-stats {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-shrink: 0;
  }
  .activity-body {
    padding: 0.5rem 0.9rem 0.85rem;
    border-top: 1px solid var(--border);
  }
  .compact-table th,
  .compact-table td {
    padding: 0.4rem 0.5rem;
    font-size: 0.85rem;
  }
  @media (max-width: 640px) {
    .hide-narrow { display: none; }
    .activity-header { gap: 0.35rem; padding: 0.55rem 0.6rem; }
    .header-stats { gap: 0.5rem; }
  }
</style>

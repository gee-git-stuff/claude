<script lang="ts">
  import { onMount } from 'svelte';
  import { activities, totals, entries, charts, refreshActivities, refreshCharts, refreshEntries } from '$lib/stores.js';
  import { formatMoney, formatDate } from '$lib/format.js';
  import { categoryDoughnutData, moneyAxis, moneyTooltip, netOverTimeData, profitabilityBarData } from '$lib/chartHelpers.js';
  import { ALL_TYPES, TYPE_LABELS } from '$lib/activityTypes.js';
  import Chart from '$lib/components/Chart.svelte';
  import type { ActivityType, EntryWithRecurrence } from '$lib/types.js';

  let selectedIds: Set<number> = new Set();
  let expanded:    Set<number> = new Set();
  let filterOpen = true;
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
          <div class="chip-row">
            {#each $activities as a (a.id)}
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

  <div class="row" style="justify-content: flex-end; gap: 0.3rem; margin-bottom: 0.5rem;">
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
        <div class="activity-body">
          <div class="row" style="gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
            <span class="muted" style="font-size: 0.85rem;">
              {items.length} {items.length === 1 ? 'entry' : 'entries'}
            </span>
            <a href="/activities/{a.id}" class="right" style="font-size: 0.85rem;">Open detail page →</a>
          </div>
          {#if items.length === 0}
            <p class="muted" style="font-size: 0.9rem;">No entries yet for this item. <a href="/activities/{a.id}">Add one →</a></p>
          {:else}
            <div style="overflow-x: auto;">
              <table class="table compact-table">
                <thead>
                  <tr><th>Date</th><th>Category</th><th>Note</th><th style="text-align: right;">Amount</th></tr>
                </thead>
                <tbody>
                  {#each items.slice(0, 12) as e (e.id)}
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
                Showing 12 most recent of {items.length}. <a href="/activities/{a.id}">View all →</a>
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

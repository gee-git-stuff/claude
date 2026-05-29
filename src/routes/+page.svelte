<script lang="ts">
  import { onMount } from 'svelte';
  import { activities, totals, charts, refreshCharts } from '$lib/stores.js';
  import { formatMoney } from '$lib/format.js';
  import { categoryDoughnutData, moneyAxis, moneyTooltip, netOverTimeData, profitabilityBarData } from '$lib/chartHelpers.js';
  import Chart from '$lib/components/Chart.svelte';
  import type { ActivityType } from '$lib/types.js';

  let months = 12;
  $: refreshCharts(months);
  onMount(() => refreshCharts(months));

  const TYPE_LABELS: Record<ActivityType, string> = {
    AIRBNB: 'AirBnB',
    TURO: 'Turo',
    PROPERTY: 'Property',
    CUSTOM: 'Other'
  };
  const ALL_TYPES: ActivityType[] = ['AIRBNB', 'TURO', 'PROPERTY', 'CUSTOM'];

  let selected: Set<ActivityType> = new Set(['AIRBNB', 'TURO', 'PROPERTY', 'CUSTOM']);
  let pickedIds: Set<number> = new Set();

  function toggleType(t: ActivityType) {
    const next = new Set(selected);
    if (next.has(t)) next.delete(t); else next.add(t);
    selected = next;
  }

  function togglePick(id: number) {
    const next = new Set(pickedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    pickedIds = next;
  }

  function clearPicks() { pickedIds = new Set(); }

  $: visible = $activities.filter((a) => {
    if (pickedIds.size > 0) return pickedIds.has(a.id);
    return selected.has(a.type);
  });
  $: visibleIdSet = new Set(visible.map((a) => a.id));

  $: totalsById = Object.fromEntries($totals.map((t) => [t.activity_id, t]));

  $: chartsData = $charts;
  $: filteredMonthly = chartsData ? chartsData.monthly.filter((r) => visibleIdSet.has(r.activity_id)) : [];
  $: netLineData = chartsData ? netOverTimeData(chartsData.labels, filteredMonthly, visible) : null;
  $: profitData = chartsData ? profitabilityBarData(filteredMonthly, visible) : null;
  $: expenseDoughnutData = chartsData ? categoryDoughnutData(chartsData.categories, 'EXPENSE', visibleIdSet) : null;

  const TIME_RANGES = [
    { value: 3,  label: '3 mo' },
    { value: 6,  label: '6 mo' },
    { value: 12, label: '1 yr' },
    { value: 24, label: '2 yr' },
    { value: 60, label: '5 yr' }
  ];

  $: combined = visible.reduce(
    (acc, a) => {
      const t = totalsById[a.id];
      if (!t) return acc;
      acc.expense += t.expense_cents;
      acc.income  += t.income_cents;
      acc.net     += t.net_cents;
      return acc;
    },
    { expense: 0, income: 0, net: 0 }
  );
</script>

<section class="section-header">
  <h2>Overview</h2>
  <span class="muted">{visible.length} of {$activities.length} activities</span>
</section>

<div class="filter-bar">
  {#each ALL_TYPES as t}
    <button
      class="filter-chip"
      class:on={selected.has(t)}
      on:click={() => toggleType(t)}
      disabled={pickedIds.size > 0}
    >{TYPE_LABELS[t]}</button>
  {/each}
  {#if pickedIds.size > 0}
    <button class="filter-chip on" on:click={clearPicks}>
      {pickedIds.size} picked — clear
    </button>
  {/if}
  <span class="muted" style="margin-left: auto; margin-right: 0.4rem; font-size: 0.85rem;">Range:</span>
  {#each TIME_RANGES as r}
    <button class="filter-chip" class:on={months === r.value} on:click={() => (months = r.value)}>{r.label}</button>
  {/each}
</div>

<div class="card" style="margin-bottom: 1rem;">
  <div class="row" style="flex-wrap: wrap; gap: 1.5rem;">
    <div>
      <div class="muted">Total income</div>
      <div class="amount good" style="font-size: 1.4rem;">{formatMoney(combined.income)}</div>
    </div>
    <div>
      <div class="muted">Total expenses</div>
      <div class="amount bad" style="font-size: 1.4rem;">{formatMoney(combined.expense)}</div>
    </div>
    <div>
      <div class="muted">Net</div>
      <div class="amount {combined.net >= 0 ? 'good' : 'bad'}" style="font-size: 1.4rem;">
        {formatMoney(combined.net)}
      </div>
    </div>
  </div>
</div>

{#if visible.length === 0}
  <div class="card">
    <p class="muted" style="margin: 0;">
      {#if $activities.length === 0}
        No activities yet. <a href="/activities">Create your first one →</a>
      {:else}
        No activities match the current filter.
      {/if}
    </p>
  </div>
{:else}
  <div class="grid">
    {#each visible as a (a.id)}
      {@const t = totalsById[a.id] ?? { expense_cents: 0, income_cents: 0, net_cents: 0 }}
      <a class="card" href="/activities/{a.id}" style="text-decoration: none; color: inherit;">
        <div class="row" style="margin-bottom: 0.5rem;">
          <span class="color-dot" style="background: {a.color};"></span>
          <strong>{a.name}</strong>
          <span class="chip right">{TYPE_LABELS[a.type]}</span>
          <button
            class="filter-chip"
            class:on={pickedIds.has(a.id)}
            on:click|preventDefault|stopPropagation={() => togglePick(a.id)}
            title="Add to picked view"
            style="padding: 0.15rem 0.5rem; font-size: 0.7rem;"
          >{pickedIds.has(a.id) ? '✓' : '+'}</button>
        </div>
        <div class="row" style="justify-content: space-between;">
          <span class="muted">Income</span>
          <span class="amount good">{formatMoney(t.income_cents)}</span>
        </div>
        <div class="row" style="justify-content: space-between;">
          <span class="muted">Expenses</span>
          <span class="amount bad">{formatMoney(t.expense_cents)}</span>
        </div>
        <div class="row" style="justify-content: space-between; margin-top: 0.4rem; padding-top: 0.4rem; border-top: 1px solid var(--border);">
          <strong>Net</strong>
          <strong class="amount {t.net_cents >= 0 ? 'good' : 'bad'}">{formatMoney(t.net_cents)}</strong>
        </div>
      </a>
    {/each}
  </div>

  {#if chartsData && visible.length > 0}
    <section class="section-header" style="margin-top: 2rem;">
      <h2>Trends</h2>
      <span class="muted">last {months} month{months === 1 ? '' : 's'}</span>
    </section>

    <div class="grid" style="grid-template-columns: minmax(0, 1fr); gap: 1rem;">
      {#if netLineData}
        <div class="card">
          <div class="muted" style="margin-bottom: 0.5rem;">Net profit / loss per month</div>
          <Chart
            type="line"
            data={netLineData}
            options={{
              plugins: { tooltip: moneyTooltip(), legend: { position: 'bottom' } },
              scales: { y: moneyAxis() }
            }}
          />
        </div>
      {/if}

      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem;">
        {#if profitData}
          <div class="card">
            <div class="muted" style="margin-bottom: 0.5rem;">Profitability ranking</div>
            <Chart
              type="bar"
              data={profitData}
              options={{
                indexAxis: 'y',
                plugins: { tooltip: moneyTooltip(), legend: { display: false } },
                scales: { x: moneyAxis() }
              }}
            />
          </div>
        {/if}
        {#if expenseDoughnutData && expenseDoughnutData.labels.length > 0}
          <div class="card">
            <div class="muted" style="margin-bottom: 0.5rem;">Expenses by category</div>
            <Chart
              type="doughnut"
              data={expenseDoughnutData}
              options={{ plugins: { tooltip: moneyTooltip(), legend: { position: 'right' } } }}
            />
          </div>
        {/if}
      </div>
    </div>
  {/if}
{/if}

<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { activities, totals, entries, charts, refreshAll, refreshEntries, refreshActions, refreshCharts, flashToast } from '$lib/stores.js';
  import { formatMoney, parseMoney, formatDate, todayIso, CATEGORIES } from '$lib/format.js';
  import { categoryDoughnutData, moneyAxis, moneyTooltip, monthlyIncomeExpenseData } from '$lib/chartHelpers.js';
  import Chart from '$lib/components/Chart.svelte';
  import type { EntryKind, RecurrenceFrequency, EntryWithRecurrence } from '$lib/types.js';

  let chartMonths = 12;

  $: id = Number($page.params.id);
  $: activity = $activities.find((a) => a.id === id);
  $: totalsRow = $totals.find((t) => t.activity_id === id);

  onMount(() => { refreshAll().then(() => refreshEntries(id)); refreshCharts(chartMonths); });
  $: if (id) refreshEntries(id);
  $: refreshCharts(chartMonths);

  $: incomeExpenseData = $charts ? monthlyIncomeExpenseData($charts.labels, $charts.monthly, id) : null;
  $: expenseDoughnut = $charts ? categoryDoughnutData($charts.categories, 'EXPENSE', new Set([id])) : null;

  let showForm = false;
  let editingId: number | null = null;
  let kind: EntryKind = 'EXPENSE';
  let amount = '';
  let date = todayIso();
  let category = CATEGORIES[0];
  let note = '';
  let isRecurring = false;
  let recFreq: RecurrenceFrequency = 'MONTHLY';
  let recInterval = 1;
  let recEnd = '';

  function openCreate(k: EntryKind) {
    editingId = null;
    kind = k;
    amount = '';
    date = todayIso();
    category = k === 'INCOME' ? 'Income' : CATEGORIES[0];
    note = '';
    isRecurring = false;
    recFreq = 'MONTHLY';
    recInterval = 1;
    recEnd = '';
    showForm = true;
  }

  function openEdit(e: EntryWithRecurrence) {
    editingId = e.id;
    kind = e.kind;
    amount = (e.amount_cents / 100).toFixed(2);
    date = e.date;
    category = e.category;
    note = e.note;
    if (e.recurrence) {
      isRecurring = true;
      recFreq = e.recurrence.frequency;
      recInterval = e.recurrence.interval;
      recEnd = e.recurrence.end_date ?? '';
    } else {
      isRecurring = false;
      recFreq = 'MONTHLY';
      recInterval = 1;
      recEnd = '';
    }
    showForm = true;
  }

  async function save() {
    const body = {
      activity_id: id,
      kind,
      amount_cents: parseMoney(amount),
      date,
      category,
      note,
      recurrence: isRecurring ? { frequency: recFreq, interval: recInterval, end_date: recEnd || null } : null
    };
    if (editingId == null) {
      await fetch('/api/entries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      flashToast(`${kind === 'EXPENSE' ? 'Expense' : 'Income'} added`);
    } else {
      await fetch(`/api/entries/${editingId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      flashToast('Entry updated');
    }
    showForm = false;
    await refreshEntries(id);
    await refreshAll();
  }

  async function remove(eid: number) {
    if (!confirm('Delete this entry? (You can undo.)')) return;
    await fetch(`/api/entries/${eid}`, { method: 'DELETE' });
    flashToast('Entry deleted');
    await refreshEntries(id);
    await refreshAll();
    await refreshActions();
  }

  function freqLabel(f: RecurrenceFrequency, interval: number) {
    const unit = f === 'DAILY' ? 'day' : f === 'WEEKLY' ? 'week' : f === 'MONTHLY' ? 'month' : 'year';
    return interval === 1 ? `every ${unit}` : `every ${interval} ${unit}s`;
  }
</script>

{#if !activity}
  <div class="card"><p class="muted">Activity not found. <a href="/activities">Back to activities</a></p></div>
{:else}
  <section class="section-header">
    <a href="/activities" class="muted">← Activities</a>
    <span class="color-dot" style="background: {activity.color};"></span>
    <h2>{activity.name}</h2>
    <span class="chip">{activity.type}</span>
  </section>

  <div class="card" style="margin-bottom: 1rem;">
    <div class="row" style="flex-wrap: wrap; gap: 1.5rem;">
      <div>
        <div class="muted">Income</div>
        <div class="amount good" style="font-size: 1.3rem;">{formatMoney(totalsRow?.income_cents ?? 0)}</div>
      </div>
      <div>
        <div class="muted">Expenses</div>
        <div class="amount bad" style="font-size: 1.3rem;">{formatMoney(totalsRow?.expense_cents ?? 0)}</div>
      </div>
      <div>
        <div class="muted">Net</div>
        <div class="amount {(totalsRow?.net_cents ?? 0) >= 0 ? 'good' : 'bad'}" style="font-size: 1.3rem;">
          {formatMoney(totalsRow?.net_cents ?? 0)}
        </div>
      </div>
      <div class="right row">
        <button class="primary" on:click={() => openCreate('EXPENSE')}>+ Expense</button>
        <button on:click={() => openCreate('INCOME')}>+ Income</button>
      </div>
    </div>
  </div>

  {#if $entries.length === 0}
    <div class="card"><p class="muted">No entries yet. Add an expense or income above.</p></div>
  {:else}
    <div class="card" style="padding: 0;">
      <table class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Note</th>
            <th style="text-align: right;">Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each $entries as e (e.id)}
            <tr>
              <td>{formatDate(e.date)}</td>
              <td>
                <span class="chip">{e.category || '—'}</span>
                {#if e.recurrence}
                  <span class="chip" style="margin-left: 0.25rem;">↻ {freqLabel(e.recurrence.frequency, e.recurrence.interval)}</span>
                {/if}
              </td>
              <td class="muted">{e.note}</td>
              <td style="text-align: right;" class="amount {e.kind === 'INCOME' ? 'good' : 'bad'}">
                {e.kind === 'INCOME' ? '+' : '−'}{formatMoney(e.amount_cents)}
              </td>
              <td style="text-align: right; white-space: nowrap;">
                <button on:click={() => openEdit(e)}>Edit</button>
                <button class="danger" on:click={() => remove(e.id)}>×</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if $entries.length > 0}
    <section class="section-header" style="margin-top: 2rem;">
      <h2>Trends</h2>
      <span class="muted">last {chartMonths} month{chartMonths === 1 ? '' : 's'}</span>
      <div class="filter-bar right" style="margin-bottom: 0;">
        {#each [3, 6, 12, 24] as m}
          <button class="filter-chip" class:on={chartMonths === m} on:click={() => (chartMonths = m)}>{m}mo</button>
        {/each}
      </div>
    </section>

    <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem;">
      {#if incomeExpenseData}
        <div class="card">
          <div class="muted" style="margin-bottom: 0.5rem;">Income vs expenses per month</div>
          <Chart
            type="bar"
            data={incomeExpenseData}
            options={{
              plugins: { tooltip: moneyTooltip(), legend: { position: 'bottom' } },
              scales: { y: moneyAxis() }
            }}
          />
        </div>
      {/if}
      {#if expenseDoughnut && expenseDoughnut.labels.length > 0}
        <div class="card">
          <div class="muted" style="margin-bottom: 0.5rem;">Expenses by category</div>
          <Chart
            type="doughnut"
            data={expenseDoughnut}
            options={{ plugins: { tooltip: moneyTooltip(), legend: { position: 'right' } } }}
          />
        </div>
      {/if}
    </div>
  {/if}
{/if}

{#if showForm}
  <div class="modal-bg" on:click|self={() => (showForm = false)} role="dialog">
    <div class="modal">
      <h3>{editingId == null ? 'New' : 'Edit'} {kind === 'EXPENSE' ? 'expense' : 'income'}</h3>
      <div class="col">
        <div>
          <label>Kind</label>
          <select bind:value={kind}>
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </div>
        <div>
          <label>Amount (USD)</label>
          <input type="text" inputmode="decimal" bind:value={amount} placeholder="0.00" />
        </div>
        <div>
          <label>Date</label>
          <input type="date" bind:value={date} />
        </div>
        <div>
          <label>Category</label>
          <select bind:value={category}>
            {#each CATEGORIES as c}<option value={c}>{c}</option>{/each}
          </select>
        </div>
        <div>
          <label>Note</label>
          <input bind:value={note} placeholder="optional" />
        </div>
        <div>
          <label>
            <input type="checkbox" bind:checked={isRecurring} style="width: auto; margin-right: 0.4rem;" />
            Recurring
          </label>
        </div>
        {#if isRecurring}
          <div class="row" style="gap: 0.5rem;">
            <div class="grow">
              <label>Frequency</label>
              <select bind:value={recFreq}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL">Annual</option>
              </select>
            </div>
            <div style="width: 5.5rem;">
              <label>Every</label>
              <input type="number" min="1" bind:value={recInterval} />
            </div>
          </div>
          <div>
            <label>End date (optional)</label>
            <input type="date" bind:value={recEnd} />
          </div>
        {/if}
        <div class="row" style="margin-top: 0.5rem;">
          <button on:click={() => (showForm = false)}>Cancel</button>
          <button class="primary right" on:click={save} disabled={!amount.trim()}>Save</button>
        </div>
      </div>
    </div>
  </div>
{/if}

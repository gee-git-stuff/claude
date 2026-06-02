<script lang="ts">
  import { onMount } from 'svelte';
  import { activities, charts, entries, refreshActivities, refreshCharts, refreshEntries, refreshActions, flashToast } from '$lib/stores.js';
  import { formatMoney, parseMoney, formatDate, todayIso, PERSONAL_CATEGORIES } from '$lib/format.js';
  import { freqLabel, monthlyAmountCents, nextOccurrence, upcomingOccurrences } from '$lib/recurrence.js';
  import { categoryDoughnutData, monthlyIncomeExpenseData, moneyAxis, moneyTooltip } from '$lib/chartHelpers.js';
  import Chart from '$lib/components/Chart.svelte';
  import DocumentsSection from '$lib/components/DocumentsSection.svelte';
  import type { Activity, EntryKind, EntryWithRecurrence, RecurrenceFrequency } from '$lib/types.js';

  type SortKey = 'category' | 'due_date';
  let sortBy: SortKey = 'due_date';

  function sortRecurring(list: EntryWithRecurrence[], by: SortKey): EntryWithRecurrence[] {
    const copy = [...list];
    if (by === 'category') {
      copy.sort((a, b) => a.category.localeCompare(b.category) || a.id - b.id);
    } else {
      copy.sort((a, b) => nextDueIso(a).localeCompare(nextDueIso(b)) || a.id - b.id);
    }
    return copy;
  }

  function sortOneTime(list: EntryWithRecurrence[], by: SortKey): EntryWithRecurrence[] {
    const copy = [...list];
    if (by === 'category') {
      copy.sort((a, b) => a.category.localeCompare(b.category) || b.date.localeCompare(a.date));
    } else {
      copy.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    }
    return copy;
  }

  let personalActivity: Activity | null = null;
  let chartMonths = 6;
  let loaded = false;

  async function init() {
    await refreshActivities();
    personalActivity = $activities.find((a) => a.type === 'PERSONAL') ?? null;
    if (personalActivity) {
      await refreshEntries(personalActivity.id);
      await refreshCharts(chartMonths);
    }
    loaded = true;
  }

  async function createPersonal() {
    const r = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Personal', type: 'PERSONAL', color: '#8b5cf6', notes: 'Personal expenses and income' })
    });
    if (!r.ok) { flashToast('Could not create'); return; }
    flashToast('Personal activity created');
    await init();
  }

  onMount(init);
  $: if (personalActivity) refreshCharts(chartMonths);

  $: personalEntries = $entries;
  $: recurringExpensesRaw = personalEntries.filter((e) => e.recurrence && e.kind === 'EXPENSE');
  $: recurringIncomeRaw   = personalEntries.filter((e) => e.recurrence && e.kind === 'INCOME');
  $: oneTimeRaw           = personalEntries.filter((e) => !e.recurrence);
  $: recurringExpenses = sortRecurring(recurringExpensesRaw, sortBy);
  $: recurringIncome   = sortRecurring(recurringIncomeRaw, sortBy);
  $: oneTime           = sortOneTime(oneTimeRaw, sortBy);

  $: monthlyBurn   = recurringExpenses.reduce((s, e) => s + monthlyAmountCents(e.amount_cents, e.recurrence!.frequency, e.recurrence!.interval), 0);
  $: monthlyIncome = recurringIncome.reduce((s, e) => s + monthlyAmountCents(e.amount_cents, e.recurrence!.frequency, e.recurrence!.interval), 0);

  $: thisMonth = todayIso().slice(0, 7);
  $: paidThisMonth = personalEntries.filter((e) => e.date.startsWith(thisMonth) && e.kind === 'EXPENSE').reduce((s, e) => s + e.amount_cents, 0);
  $: incomeThisMonth = personalEntries.filter((e) => e.date.startsWith(thisMonth) && e.kind === 'INCOME').reduce((s, e) => s + e.amount_cents, 0);
  $: netThisMonth = incomeThisMonth - paidThisMonth;

  $: upcoming = upcomingOccurrences(personalEntries.filter((e) => e.recurrence) as EntryWithRecurrence[], 30);

  function nextDueIso(e: EntryWithRecurrence): string {
    if (!e.recurrence) return e.date;
    const d = nextOccurrence(e.date, e.recurrence.frequency, e.recurrence.interval);
    return d ? d.toISOString().slice(0, 10) : '—';
  }

  let showForm = false;
  let editingId: number | null = null;
  let kind: EntryKind = 'EXPENSE';
  let amount = '';
  let date = todayIso();
  let category = PERSONAL_CATEGORIES[0];
  let note = '';
  let isRecurring = true;
  let recFreq: RecurrenceFrequency = 'MONTHLY';
  let recInterval = 1;
  let recEnd = '';

  function resetForm() {
    editingId = null;
    kind = 'EXPENSE';
    amount = '';
    date = todayIso();
    category = PERSONAL_CATEGORIES[0];
    note = '';
    isRecurring = true;
    recFreq = 'MONTHLY';
    recInterval = 1;
    recEnd = '';
  }

  function openAdd(k: EntryKind, recurring: boolean) {
    resetForm();
    kind = k;
    isRecurring = recurring;
    category = k === 'INCOME' ? 'Salary' : 'Mortgage';
    showForm = true;
  }

  function openEdit(e: EntryWithRecurrence) {
    editingId = e.id;
    kind = e.kind;
    amount = (e.amount_cents / 100).toFixed(2);
    date = e.date;
    category = e.category || PERSONAL_CATEGORIES[0];
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

  async function saveEntry() {
    if (!personalActivity) return;
    const body = {
      activity_id: personalActivity.id,
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
    if (personalActivity) await refreshEntries(personalActivity.id);
    await refreshCharts(chartMonths);
    await refreshActions();
  }

  async function removeEntry(id: number) {
    if (!confirm('Delete this entry? (You can undo.)')) return;
    await fetch(`/api/entries/${id}`, { method: 'DELETE' });
    flashToast('Entry deleted');
    if (personalActivity) await refreshEntries(personalActivity.id);
    await refreshCharts(chartMonths);
    await refreshActions();
  }

  $: incomeExpenseData = personalActivity && $charts
    ? monthlyIncomeExpenseData($charts.labels, $charts.monthly, personalActivity.id)
    : null;
  $: categoryData = personalActivity && $charts
    ? categoryDoughnutData($charts.categories, 'EXPENSE', new Set([personalActivity.id]))
    : null;
</script>

{#if !loaded}
  <div class="card"><p class="muted">Loading…</p></div>
{:else if !personalActivity}
  <div class="card">
    <h2 style="margin-top: 0;">Set up Personal</h2>
    <p>This is where your bills, subscriptions, and personal income live — separate from your side hustles.</p>
    <p class="muted" style="font-size: 0.9rem;">
      One umbrella "Personal" activity will be created. You can then add recurring bills (Mortgage, Internet, etc.),
      track paychecks, see your monthly burn rate, and view upcoming bills for the next 30 days.
    </p>
    <button class="primary" on:click={createPersonal}>Create my Personal activity</button>
  </div>
{:else}
  <section class="section-header">
    <h2>Personal</h2>
    <div class="row right" style="gap: 0.3rem; flex-wrap: wrap;">
      <span class="muted" style="font-size: 0.85rem; align-self: center;">Sort:</span>
      <select bind:value={sortBy} style="width: auto;">
        <option value="due_date">Due date</option>
        <option value="category">Category</option>
      </select>
      <button class="primary" on:click={() => openAdd('EXPENSE', true)}>+ Recurring bill</button>
      <button on:click={() => openAdd('INCOME', true)}>+ Recurring income</button>
      <button on:click={() => openAdd('EXPENSE', false)}>+ One-time</button>
    </div>
  </section>

  <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
    <div class="card">
      <div class="muted" style="font-size: 0.85rem;">Monthly burn</div>
      <div class="amount bad" style="font-size: 1.5rem;">{formatMoney(monthlyBurn)}</div>
      <div class="muted" style="font-size: 0.8rem;">{recurringExpenses.length} recurring</div>
    </div>
    <div class="card">
      <div class="muted" style="font-size: 0.85rem;">Monthly income</div>
      <div class="amount good" style="font-size: 1.5rem;">{formatMoney(monthlyIncome)}</div>
      <div class="muted" style="font-size: 0.8rem;">{recurringIncome.length} recurring</div>
    </div>
    <div class="card">
      <div class="muted" style="font-size: 0.85rem;">Projected monthly net</div>
      <div class="amount {monthlyIncome - monthlyBurn >= 0 ? 'good' : 'bad'}" style="font-size: 1.5rem;">
        {formatMoney(monthlyIncome - monthlyBurn)}
      </div>
      <div class="muted" style="font-size: 0.8rem;">income − burn</div>
    </div>
    <div class="card">
      <div class="muted" style="font-size: 0.85rem;">Net this month (actual)</div>
      <div class="amount {netThisMonth >= 0 ? 'good' : 'bad'}" style="font-size: 1.5rem;">
        {formatMoney(netThisMonth)}
      </div>
      <div class="muted" style="font-size: 0.8rem;">{formatMoney(incomeThisMonth)} in − {formatMoney(paidThisMonth)} out</div>
    </div>
  </div>

  <section class="section-header" style="margin-top: 0.5rem;">
    <h3 style="margin: 0; font-size: 1.05rem;">Recurring expenses</h3>
    <span class="muted" style="font-size: 0.85rem;">{recurringExpenses.length}</span>
  </section>

  {#if recurringExpenses.length === 0}
    <div class="card"><p class="muted">No recurring bills yet. Tap "+ Recurring bill" to add one.</p></div>
  {:else}
    <div class="card" style="padding: 0; margin-bottom: 1rem;">
      <table class="table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Note</th>
            <th>Frequency</th>
            <th>Next due</th>
            <th style="text-align: right;">Amount</th>
            <th style="text-align: right;">/ month</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each recurringExpenses as e (e.id)}
            {@const monthly = e.recurrence ? monthlyAmountCents(e.amount_cents, e.recurrence.frequency, e.recurrence.interval) : 0}
            <tr>
              <td><span class="chip">{e.category}</span></td>
              <td class="muted">{e.note}</td>
              <td class="muted" style="font-size: 0.85rem;">{e.recurrence ? freqLabel(e.recurrence.frequency, e.recurrence.interval) : ''}</td>
              <td>{formatDate(nextDueIso(e))}</td>
              <td style="text-align: right;" class="amount bad">{formatMoney(e.amount_cents)}</td>
              <td style="text-align: right;" class="amount bad">{formatMoney(monthly)}</td>
              <td style="text-align: right; white-space: nowrap;">
                <button on:click={() => openEdit(e)}>Edit</button>
                <button class="danger" on:click={() => removeEntry(e.id)}>×</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if recurringIncome.length > 0}
    <section class="section-header" style="margin-top: 0.5rem;">
      <h3 style="margin: 0; font-size: 1.05rem;">Recurring income</h3>
      <span class="muted" style="font-size: 0.85rem;">{recurringIncome.length}</span>
    </section>
    <div class="card" style="padding: 0; margin-bottom: 1rem;">
      <table class="table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Note</th>
            <th>Frequency</th>
            <th>Next due</th>
            <th style="text-align: right;">Amount</th>
            <th style="text-align: right;">/ month</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each recurringIncome as e (e.id)}
            {@const monthly = e.recurrence ? monthlyAmountCents(e.amount_cents, e.recurrence.frequency, e.recurrence.interval) : 0}
            <tr>
              <td><span class="chip">{e.category}</span></td>
              <td class="muted">{e.note}</td>
              <td class="muted" style="font-size: 0.85rem;">{e.recurrence ? freqLabel(e.recurrence.frequency, e.recurrence.interval) : ''}</td>
              <td>{formatDate(nextDueIso(e))}</td>
              <td style="text-align: right;" class="amount good">{formatMoney(e.amount_cents)}</td>
              <td style="text-align: right;" class="amount good">{formatMoney(monthly)}</td>
              <td style="text-align: right; white-space: nowrap;">
                <button on:click={() => openEdit(e)}>Edit</button>
                <button class="danger" on:click={() => removeEntry(e.id)}>×</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <section class="section-header" style="margin-top: 0.5rem;">
    <h3 style="margin: 0; font-size: 1.05rem;">Upcoming next 30 days</h3>
    <span class="muted" style="font-size: 0.85rem;">{upcoming.length} occurrences</span>
  </section>

  {#if upcoming.length === 0}
    <div class="card"><p class="muted">Nothing due in the next 30 days.</p></div>
  {:else}
    <div class="card" style="padding: 0; margin-bottom: 1rem;">
      <table class="table">
        <thead>
          <tr><th>Date</th><th>Category</th><th>Note</th><th style="text-align: right;">Amount</th></tr>
        </thead>
        <tbody>
          {#each upcoming as u}
            <tr>
              <td>{formatDate(u.date)}</td>
              <td><span class="chip">{u.item.category}</span></td>
              <td class="muted">{u.item.note}</td>
              <td style="text-align: right;" class="amount {u.item.kind === 'INCOME' ? 'good' : 'bad'}">
                {u.item.kind === 'INCOME' ? '+' : '−'}{formatMoney(u.item.amount_cents)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if oneTime.length > 0}
    <section class="section-header" style="margin-top: 0.5rem;">
      <h3 style="margin: 0; font-size: 1.05rem;">One-time entries</h3>
      <span class="muted" style="font-size: 0.85rem;">{oneTime.length}</span>
    </section>
    <div class="card" style="padding: 0; margin-bottom: 1rem;">
      <table class="table">
        <thead>
          <tr><th>Date</th><th>Category</th><th>Note</th><th style="text-align: right;">Amount</th><th></th></tr>
        </thead>
        <tbody>
          {#each oneTime.slice(0, 30) as e (e.id)}
            <tr>
              <td>{formatDate(e.date)}</td>
              <td><span class="chip">{e.category}</span></td>
              <td class="muted">{e.note}</td>
              <td style="text-align: right;" class="amount {e.kind === 'INCOME' ? 'good' : 'bad'}">
                {e.kind === 'INCOME' ? '+' : '−'}{formatMoney(e.amount_cents)}
              </td>
              <td style="text-align: right; white-space: nowrap;">
                <button on:click={() => openEdit(e)}>Edit</button>
                <button class="danger" on:click={() => removeEntry(e.id)}>×</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if oneTime.length > 30}
        <p class="muted" style="padding: 0.5rem; margin: 0; font-size: 0.85rem;">Showing 30 most recent of {oneTime.length}.</p>
      {/if}
    </div>
  {/if}

  <section class="section-header" style="margin-top: 1.5rem;">
    <h3 style="margin: 0; font-size: 1.05rem;">Trends</h3>
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
        <Chart type="bar" data={incomeExpenseData}
          options={{ plugins: { tooltip: moneyTooltip(), legend: { position: 'bottom' } }, scales: { y: moneyAxis() } }} />
      </div>
    {/if}
    {#if categoryData && categoryData.labels.length > 0}
      <div class="card">
        <div class="muted" style="margin-bottom: 0.5rem;">Expenses by category</div>
        <Chart type="doughnut" data={categoryData}
          options={{ plugins: { tooltip: moneyTooltip(), legend: { position: 'right' } } }} />
      </div>
    {/if}
  </div>

  <section class="section-header" style="margin-top: 1.5rem;">
    <h3 style="margin: 0; font-size: 1.05rem;">Documents</h3>
    <span class="muted" style="font-size: 0.85rem;">receipts, bills, statements</span>
  </section>
  <DocumentsSection activityId={personalActivity.id} />
{/if}

{#if showForm}
  <div class="modal-bg" on:click|self={() => (showForm = false)} role="dialog">
    <div class="modal">
      <h3>{editingId == null ? 'New' : 'Edit'} {kind === 'EXPENSE' ? 'expense' : 'income'}{isRecurring ? ' (recurring)' : ''}</h3>
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
          <label>{isRecurring ? 'First occurrence' : 'Date'}</label>
          <input type="date" bind:value={date} />
        </div>
        <div>
          <label>Category</label>
          <select bind:value={category}>
            {#each PERSONAL_CATEGORIES as c}<option value={c}>{c}</option>{/each}
          </select>
        </div>
        <div>
          <label>Note</label>
          <input bind:value={note} placeholder="e.g. Chase mortgage account #1234" />
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
            <label>End date <span class="muted">(optional)</span></label>
            <input type="date" bind:value={recEnd} />
          </div>
        {/if}
        <div class="row" style="margin-top: 0.5rem;">
          <button on:click={() => (showForm = false)}>Cancel</button>
          <button class="primary right" on:click={saveEntry} disabled={!amount.trim()}>Save</button>
        </div>
      </div>
    </div>
  </div>
{/if}

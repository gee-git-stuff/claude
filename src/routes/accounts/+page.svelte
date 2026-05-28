<script lang="ts">
  import { accounts, refreshAccounts, refreshActions, flashToast } from '$lib/stores.js';
  import { formatMoney, parseMoney } from '$lib/format.js';
  import type { AccountType, Account } from '$lib/types.js';

  const TYPE_LABELS: Record<AccountType, string> = {
    CHECKING: 'Checking',
    SAVINGS: 'Savings',
    CREDIT: 'Credit',
    LOAN: 'Loan',
    CASH: 'Cash',
    OTHER: 'Other'
  };

  const ASSET_TYPES: AccountType[] = ['CHECKING', 'SAVINGS', 'CASH', 'OTHER'];
  const DEBT_TYPES: AccountType[]  = ['CREDIT', 'LOAN'];

  let showForm = false;
  let editingId: number | null = null;
  let name = '';
  let type: AccountType = 'CHECKING';
  let balance = '';
  let notes = '';

  $: assets = $accounts.filter((a) => ASSET_TYPES.includes(a.type));
  $: debts  = $accounts.filter((a) => DEBT_TYPES.includes(a.type));
  $: totalAssets = assets.reduce((s, a) => s + a.balance_cents, 0);
  $: totalDebts  = debts.reduce((s, a) => s + a.balance_cents, 0);
  $: netWorth    = totalAssets - totalDebts;

  function openCreate() {
    editingId = null;
    name = '';
    type = 'CHECKING';
    balance = '';
    notes = '';
    showForm = true;
  }

  function openEdit(a: Account) {
    editingId = a.id;
    name = a.name;
    type = a.type;
    balance = (a.balance_cents / 100).toFixed(2);
    notes = a.notes;
    showForm = true;
  }

  async function save() {
    const body = { name, type, balance_cents: parseMoney(balance), notes };
    if (editingId == null) {
      await fetch('/api/accounts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      flashToast('Account added');
    } else {
      await fetch(`/api/accounts/${editingId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      flashToast('Account updated');
    }
    showForm = false;
    await refreshAccounts();
    await refreshActions();
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Delete "${name}"? (You can undo.)`)) return;
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    flashToast('Account deleted');
    await refreshAccounts();
    await refreshActions();
  }
</script>

<section class="section-header">
  <h2>Accounts</h2>
  <button class="primary right" on:click={openCreate}>+ New account</button>
</section>

<div class="card" style="margin-bottom: 1rem;">
  <div class="row" style="flex-wrap: wrap; gap: 1.5rem;">
    <div>
      <div class="muted">Assets</div>
      <div class="amount good" style="font-size: 1.3rem;">{formatMoney(totalAssets)}</div>
    </div>
    <div>
      <div class="muted">Debts</div>
      <div class="amount bad" style="font-size: 1.3rem;">{formatMoney(totalDebts)}</div>
    </div>
    <div>
      <div class="muted">Net worth</div>
      <div class="amount {netWorth >= 0 ? 'good' : 'bad'}" style="font-size: 1.3rem;">
        {formatMoney(netWorth)}
      </div>
    </div>
  </div>
</div>

<p class="muted" style="font-size: 0.85rem; margin-bottom: 1rem;">
  Click an account to view transactions and import a CSV from your bank.
</p>

{#if $accounts.length === 0}
  <div class="card"><p class="muted">No accounts yet.</p></div>
{:else}
  <div class="card" style="padding: 0;">
    <table class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Notes</th>
          <th style="text-align: right;">Balance</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each $accounts as a (a.id)}
          <tr>
            <td><a href="/accounts/{a.id}">{a.name}</a></td>
            <td><span class="chip">{TYPE_LABELS[a.type]}</span></td>
            <td class="muted">{a.notes}</td>
            <td style="text-align: right;" class="amount {DEBT_TYPES.includes(a.type) ? 'bad' : 'good'}">
              {DEBT_TYPES.includes(a.type) ? '−' : ''}{formatMoney(a.balance_cents)}
            </td>
            <td style="text-align: right; white-space: nowrap;">
              <button on:click={() => openEdit(a)}>Edit</button>
              <button class="danger" on:click={() => remove(a.id, a.name)}>Delete</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

{#if showForm}
  <div class="modal-bg" on:click|self={() => (showForm = false)} role="dialog">
    <div class="modal">
      <h3>{editingId == null ? 'New account' : 'Edit account'}</h3>
      <div class="col">
        <div>
          <label>Name</label>
          <input bind:value={name} placeholder="e.g. Chase Checking" />
        </div>
        <div>
          <label>Type</label>
          <select bind:value={type}>
            <option value="CHECKING">Checking</option>
            <option value="SAVINGS">Savings</option>
            <option value="CASH">Cash</option>
            <option value="CREDIT">Credit card</option>
            <option value="LOAN">Loan / mortgage</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label>Balance (USD) {#if DEBT_TYPES.includes(type)}<span class="muted">— amount owed</span>{/if}</label>
          <input type="text" inputmode="decimal" bind:value={balance} placeholder="0.00" />
        </div>
        <div>
          <label>Notes</label>
          <input bind:value={notes} placeholder="optional" />
        </div>
        <div class="row" style="margin-top: 0.5rem;">
          <button on:click={() => (showForm = false)}>Cancel</button>
          <button class="primary right" on:click={save} disabled={!name.trim()}>Save</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { accounts, transactions, refreshAccounts, refreshTransactions, refreshActions, flashToast } from '$lib/stores.js';
  import { formatMoney, parseMoney, formatDate } from '$lib/format.js';
  import { detectDelimiter, parseCsv, applyMapping, type ParsedTxn } from '$lib/csv.js';
  import { DEFAULT_CSV_MAPPING, type CsvMapping } from '$lib/types.js';

  $: id = Number($page.params.id);
  $: account = $accounts.find((a) => a.id === id);

  onMount(async () => {
    await refreshAccounts();
    if (id) await refreshTransactions(id);
  });

  let showImport = false;
  let csvText = '';
  let rawRows: string[][] = [];
  let mapping: CsvMapping = { ...DEFAULT_CSV_MAPPING };
  let newBalanceInput = '';

  async function openImport() {
    showImport = true;
    csvText = '';
    rawRows = [];
    newBalanceInput = ((account?.balance_cents ?? 0) / 100).toFixed(2);
    if (account?.csv_mapping_json) {
      try {
        const saved = JSON.parse(account.csv_mapping_json) as Partial<CsvMapping>;
        mapping = { ...DEFAULT_CSV_MAPPING, ...saved };
      } catch { mapping = { ...DEFAULT_CSV_MAPPING }; }
    }
  }

  async function onFile(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    csvText = await file.text();
    reparse();
  }

  function onPaste() {
    reparse();
  }

  function reparse() {
    if (!csvText.trim()) { rawRows = []; return; }
    if (!mapping.delimiter || rawRows.length === 0) {
      mapping.delimiter = detectDelimiter(csvText);
    }
    rawRows = parseCsv(csvText, mapping.delimiter);
  }

  $: parsed = rawRows.length > 0 ? applyMapping(rawRows, mapping) : [];
  $: validTxns = parsed.filter((p) => p.valid);
  $: invalidTxns = parsed.filter((p) => !p.valid);
  $: alreadyImportedSet = new Set($transactions.map((t) => t.raw_row));
  $: newTxns = validTxns.filter((p) => !alreadyImportedSet.has(p.raw_row));
  $: duplicateCount = validTxns.length - newTxns.length;
  $: columnCount = rawRows[0]?.length ?? 0;
  $: previewRows = rawRows.slice(0, 6);

  async function doImport() {
    if (!account || newTxns.length === 0) return;
    const body = {
      transactions: newTxns.map((t) => ({
        date: t.date,
        amount_cents: t.amount_cents,
        description: t.description,
        raw_row: t.raw_row
      })),
      new_balance_cents: parseMoney(newBalanceInput),
      mapping
    };
    const r = await fetch(`/api/accounts/${id}/import`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    const j = await r.json();
    flashToast(`Imported ${j.inserted} (${j.skipped} skipped)`);
    showImport = false;
    await refreshAccounts();
    await refreshTransactions(id);
    await refreshActions();
  }

  async function removeTxn(txnId: number) {
    if (!confirm('Delete this transaction? (You can undo.)')) return;
    await fetch(`/api/transactions/${txnId}`, { method: 'DELETE' });
    flashToast('Transaction deleted');
    await refreshTransactions(id);
    await refreshActions();
  }

  function colLabel(i: number) {
    return rawRows[mapping.skip_rows - 1]?.[i] ? `${i}: ${rawRows[mapping.skip_rows - 1][i]}`.slice(0, 30) : `Column ${i}`;
  }

  $: columnOptions = Array.from({ length: columnCount }, (_, i) => ({ value: i, label: colLabel(i) }));
</script>

{#if !account}
  <div class="card"><p class="muted">Account not found. <a href="/accounts">Back to accounts</a></p></div>
{:else}
  <section class="section-header">
    <a href="/accounts" class="muted">← Accounts</a>
    <h2>{account.name}</h2>
    <span class="chip">{account.type}</span>
    <div class="right row">
      <button class="primary" on:click={openImport}>Import CSV</button>
    </div>
  </section>

  <div class="card" style="margin-bottom: 1rem;">
    <div class="row" style="flex-wrap: wrap; gap: 1.5rem;">
      <div>
        <div class="muted">Balance</div>
        <div class="amount {account.balance_cents >= 0 ? 'good' : 'bad'}" style="font-size: 1.4rem;">{formatMoney(account.balance_cents)}</div>
      </div>
      <div>
        <div class="muted">Transactions</div>
        <div class="amount" style="font-size: 1.4rem;">{$transactions.length}</div>
      </div>
      <div>
        <div class="muted">Last updated</div>
        <div class="muted" style="padding-top: 0.4rem;">{account.updated_at}</div>
      </div>
    </div>
    {#if account.notes}<p class="muted" style="margin-bottom: 0; margin-top: 0.5rem;">{account.notes}</p>{/if}
  </div>

  {#if $transactions.length === 0}
    <div class="card"><p class="muted">No transactions yet. Click "Import CSV" to upload from your bank.</p></div>
  {:else}
    <div class="card" style="padding: 0;">
      <table class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th style="text-align: right;">Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each $transactions as t (t.id)}
            <tr>
              <td>{formatDate(t.date)}</td>
              <td>{t.description}</td>
              <td style="text-align: right;" class="amount {t.amount_cents >= 0 ? 'good' : 'bad'}">
                {t.amount_cents >= 0 ? '+' : '−'}{formatMoney(Math.abs(t.amount_cents))}
              </td>
              <td style="text-align: right;">
                <button class="danger" on:click={() => removeTxn(t.id)}>×</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/if}

{#if showImport}
  <div class="modal-bg" on:click|self={() => (showImport = false)} role="dialog">
    <div class="modal" style="max-width: 720px;">
      <h3>Import CSV — {account?.name}</h3>

      <div class="col">
        <div>
          <label>1. Choose a CSV file (or paste below)</label>
          <input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" on:change={onFile} />
        </div>

        <div>
          <label>Or paste CSV content</label>
          <textarea bind:value={csvText} on:blur={onPaste} rows="3" placeholder="date,description,amount&#10;2026-05-01,Coffee,-4.50"></textarea>
        </div>

        {#if rawRows.length > 0}
          <hr style="border: none; border-top: 1px solid var(--border);" />

          <div>
            <label>2. Mapping <span class="muted">— remembered for next time</span></label>
            <div class="row" style="flex-wrap: wrap; gap: 0.5rem;">
              <div style="min-width: 6rem;">
                <label>Delimiter</label>
                <select bind:value={mapping.delimiter} on:change={reparse}>
                  <option value=",">Comma ,</option>
                  <option value=";">Semicolon ;</option>
                  <option value={'\t'}>Tab</option>
                  <option value="|">Pipe |</option>
                </select>
              </div>
              <div style="min-width: 6rem;">
                <label>Skip rows</label>
                <input type="number" min="0" bind:value={mapping.skip_rows} />
              </div>
              <div style="min-width: 9rem;" class="grow">
                <label>Date column</label>
                <select bind:value={mapping.date_col}>
                  {#each columnOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}
                </select>
              </div>
              <div style="min-width: 9rem;" class="grow">
                <label>Amount column</label>
                <select bind:value={mapping.amount_col}>
                  {#each columnOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}
                </select>
              </div>
              <div style="min-width: 9rem;" class="grow">
                <label>Description column</label>
                <select bind:value={mapping.description_col}>
                  {#each columnOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}
                </select>
              </div>
              <div style="min-width: 7rem;">
                <label>Date format</label>
                <select bind:value={mapping.date_format}>
                  <option value="AUTO">Auto-detect</option>
                  <option value="YMD">YYYY-MM-DD</option>
                  <option value="MDY">MM/DD/YYYY</option>
                  <option value="DMY">DD/MM/YYYY</option>
                </select>
              </div>
              <div style="display: flex; align-items: flex-end;">
                <label style="display: flex; align-items: center; gap: 0.4rem;">
                  <input type="checkbox" bind:checked={mapping.invert_sign} style="width: auto;" />
                  <span>Invert sign (debits positive)</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label>3. Raw preview <span class="muted">— first {previewRows.length} of {rawRows.length} rows</span></label>
            <div style="overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius);">
              <table class="table" style="font-size: 0.8rem;">
                <thead>
                  <tr>
                    {#each Array.from({ length: columnCount }) as _, i}
                      <th>
                        {i === mapping.date_col ? '📅 ' : ''}
                        {i === mapping.amount_col ? '💲 ' : ''}
                        {i === mapping.description_col ? '📝 ' : ''}
                        col {i}
                      </th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each previewRows as r, idx}
                    <tr style:opacity={idx < mapping.skip_rows ? 0.4 : 1}>
                      {#each Array.from({ length: columnCount }) as _, i}
                        <td>{r[i] ?? ''}</td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <label>4. Parsed transactions
              <span class="muted">
                — {newTxns.length} new, {duplicateCount} duplicate{duplicateCount === 1 ? '' : 's'},
                {invalidTxns.length} invalid
              </span>
            </label>
            <div style="max-height: 240px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius);">
              <table class="table" style="font-size: 0.85rem;">
                <thead>
                  <tr><th>Date</th><th>Description</th><th style="text-align:right;">Amount</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {#each parsed.slice(0, 100) as p}
                    <tr style:opacity={p.valid ? 1 : 0.6}>
                      <td>{p.date || '—'}</td>
                      <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis;">{p.description}</td>
                      <td style="text-align: right;" class="amount {p.amount_cents >= 0 ? 'good' : 'bad'}">
                        {p.valid ? (p.amount_cents >= 0 ? '+' : '−') + formatMoney(Math.abs(p.amount_cents)) : '—'}
                      </td>
                      <td>
                        {#if !p.valid}<span class="chip" style="background: var(--bad); color: white;">{p.error}</span>
                        {:else if alreadyImportedSet.has(p.raw_row)}<span class="chip">duplicate</span>
                        {:else}<span class="chip" style="background: var(--good); color: white;">new</span>{/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
            {#if parsed.length > 100}
              <p class="muted" style="font-size: 0.8rem; margin: 0.25rem 0 0;">Showing first 100 of {parsed.length}. All {newTxns.length} new transactions will be imported.</p>
            {/if}
          </div>

          <div>
            <label>5. New balance after import (USD)</label>
            <input type="text" inputmode="decimal" bind:value={newBalanceInput} placeholder="0.00" />
            <p class="muted" style="font-size: 0.8rem; margin: 0.25rem 0 0;">
              Defaults to the current balance. Set this to whatever your bank shows as your current balance.
            </p>
          </div>
        {/if}

        <div class="row" style="margin-top: 0.5rem;">
          <button on:click={() => (showImport = false)}>Cancel</button>
          <button class="primary right" on:click={doImport} disabled={newTxns.length === 0}>
            Import {newTxns.length} transaction{newTxns.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

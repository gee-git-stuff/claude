<script lang="ts">
  import { onMount } from 'svelte';
  import type { ActionRecord } from '$lib/types.js';
  import { formatDate } from '$lib/format.js';
  import { doUndo, doRedo, canUndo, canRedo, refreshAll } from '$lib/stores.js';

  let history: ActionRecord[] = [];

  async function load() {
    const r = await fetch('/api/actions');
    const j = await r.json();
    history = j.history;
  }

  onMount(load);

  async function undoOne() { await doUndo(); await load(); }
  async function redoOne() { await doRedo(); await load(); }

  async function undoUntil(targetId: number) {
    if (!confirm(`Undo all actions back to this point?`)) return;
    let safety = 250;
    while (safety-- > 0) {
      const top = history.find((h) => h.undone === 0);
      if (!top || top.id < targetId) break;
      const r = await fetch('/api/actions/undo', { method: 'POST' });
      const j = await r.json();
      if (!j.undone) break;
      await load();
    }
    await refreshAll();
  }

  function formatTime(iso: string) {
    const d = new Date(iso.replace(' ', 'T') + 'Z');
    return `${formatDate(d.toISOString())} ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
</script>

<section class="section-header">
  <h2>History</h2>
  <div class="toolbar right">
    <button on:click={undoOne} disabled={!$canUndo}>↶ Undo last</button>
    <button on:click={redoOne} disabled={!$canRedo}>↷ Redo</button>
  </div>
</section>

<p class="muted" style="font-size: 0.85rem; margin-bottom: 1rem;">
  Last 200 actions are kept. Click a row to revert back to that point.
</p>

{#if history.length === 0}
  <div class="card"><p class="muted">No actions recorded yet.</p></div>
{:else}
  <div class="card" style="padding: 0;">
    <table class="table">
      <thead>
        <tr>
          <th>When</th>
          <th>Action</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each history as h (h.id)}
          <tr style:opacity={h.undone ? 0.5 : 1}>
            <td class="muted">{formatTime(h.created_at)}</td>
            <td>{h.summary}</td>
            <td>
              {#if h.undone}
                <span class="chip">undone</span>
              {:else}
                <span class="chip" style="background: var(--good); color: white;">active</span>
              {/if}
            </td>
            <td style="text-align: right;">
              {#if !h.undone}
                <button on:click={() => undoUntil(h.id)}>Revert to before this</button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

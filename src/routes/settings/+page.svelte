<script lang="ts">
  import { onMount } from 'svelte';
  import { flashToast } from '$lib/stores.js';

  let ollamaUrl = '';
  let ollamaModel = '';
  let status: { ok: boolean; reason?: string; models?: string[] } | null = null;
  let checking = false;
  let saving = false;

  interface BackupFile {
    filename: string;
    path: string;
    size_bytes: number;
    created_at: string;
  }
  let backups: BackupFile[] = [];
  let backingUp = false;

  async function loadBackups() {
    const r = await fetch('/api/backups');
    if (r.ok) backups = (await r.json()).backups;
  }

  async function backupNow() {
    backingUp = true;
    const r = await fetch('/api/backups', { method: 'POST' });
    backingUp = false;
    if (r.ok) {
      const j = await r.json();
      flashToast(`Backup saved: ${j.backup.filename}`);
      await loadBackups();
    } else {
      const j = await r.json().catch(() => ({ message: 'Backup failed' }));
      flashToast(j.message ?? 'Backup failed');
    }
  }

  function fmtSize(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  }

  function fmtDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  }

  async function load() {
    const r = await fetch('/api/settings');
    const j = await r.json();
    ollamaUrl = j.settings.ollama_url ?? '';
    ollamaModel = j.settings.ollama_model ?? '';
  }

  async function save() {
    saving = true;
    const r = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ollama_url: ollamaUrl, ollama_model: ollamaModel })
    });
    saving = false;
    if (r.ok) flashToast('Settings saved');
    else flashToast('Save failed');
  }

  async function test() {
    checking = true;
    status = null;
    await save();
    const r = await fetch('/api/settings', { method: 'POST' });
    status = await r.json();
    checking = false;
  }

  onMount(async () => {
    await load();
    await loadBackups();
  });

  $: hasModel = status?.ok && status.models?.some((m) => m === ollamaModel || m.startsWith(ollamaModel + ':'));
</script>

<section class="section-header">
  <h2>Settings</h2>
</section>

<div class="card" style="max-width: 600px;">
  <h3 style="margin-top: 0;">AI document scanning (Ollama)</h3>
  <p class="muted" style="font-size: 0.9rem;">
    The dashboard talks to a local Ollama instance to extract data from receipts and bills. Nothing leaves your machine.
  </p>

  <div class="col">
    <div>
      <label>Ollama URL</label>
      <input type="text" bind:value={ollamaUrl} placeholder="http://localhost:11434" />
    </div>
    <div>
      <label>Vision model</label>
      <input type="text" bind:value={ollamaModel} placeholder="llama3.2-vision" />
      <p class="muted" style="font-size: 0.8rem; margin: 0.25rem 0 0;">
        Recommended: <code>llama3.2-vision</code> (8 GB), or <code>qwen2.5-vision</code> for stronger number parsing.
      </p>
    </div>
    <div class="row" style="margin-top: 0.5rem;">
      <button on:click={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      <button class="primary right" on:click={test} disabled={checking}>
        {checking ? 'Testing…' : 'Save & test connection'}
      </button>
    </div>

    {#if status}
      <div class="card" style="background: var(--bg-3); margin-top: 0.5rem;">
        {#if status.ok}
          <div class="good">✓ Connected to Ollama</div>
          <div class="muted" style="font-size: 0.85rem; margin-top: 0.4rem;">
            Models available: {status.models?.join(', ') || '(none — pull one with: ollama pull llama3.2-vision)'}
          </div>
          {#if !hasModel && status.models && status.models.length > 0}
            <div class="bad" style="font-size: 0.85rem; margin-top: 0.4rem;">
              ⚠ "{ollamaModel}" isn't pulled. Run: <code>ollama pull {ollamaModel}</code>
            </div>
          {/if}
        {:else}
          <div class="bad">✗ Cannot reach Ollama</div>
          <div class="muted" style="font-size: 0.85rem; margin-top: 0.4rem;">
            {status.reason ?? 'Unknown error'}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<div class="card" style="max-width: 600px; margin-top: 1rem;">
  <h3 style="margin-top: 0; font-size: 1rem;">Setup steps</h3>
  <ol class="muted" style="font-size: 0.9rem; padding-left: 1.2rem;">
    <li>Install Ollama: <a href="https://ollama.com/download" target="_blank" rel="noopener">ollama.com/download</a></li>
    <li>In a terminal, pull a vision model: <code>ollama pull llama3.2-vision</code></li>
    <li>Ollama runs as a background service on port 11434.</li>
    <li>Save the settings above and click "Save & test connection" to verify.</li>
    <li>Then upload an image in any activity's Documents section and click "Scan with AI".</li>
  </ol>
</div>

<div class="card" style="max-width: 600px; margin-top: 1rem;">
  <div class="row" style="align-items: center;">
    <h3 style="margin: 0;">Local backups</h3>
    <button class="primary right" on:click={backupNow} disabled={backingUp}>
      {backingUp ? 'Backing up…' : 'Backup now'}
    </button>
  </div>
  <p class="muted" style="font-size: 0.85rem;">
    Snapshots of <code>data/expenses.db</code> are saved to <code>data/backups/</code>.
    One is written automatically at server startup (once every 6 hours), and you can
    trigger one on demand. The most recent 30 are kept.
  </p>

  {#if backups.length === 0}
    <p class="muted" style="font-size: 0.9rem;">No backups yet.</p>
  {:else}
    <div style="max-height: 320px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius);">
      <table class="table" style="font-size: 0.85rem;">
        <thead>
          <tr>
            <th>Created</th>
            <th>Filename</th>
            <th style="text-align: right;">Size</th>
          </tr>
        </thead>
        <tbody>
          {#each backups as b (b.filename)}
            <tr>
              <td>{fmtDate(b.created_at)}</td>
              <td style="font-family: ui-monospace, monospace; font-size: 0.8rem;">{b.filename}</td>
              <td style="text-align: right;">{fmtSize(b.size_bytes)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <details style="margin-top: 0.75rem;">
    <summary class="muted" style="cursor: pointer; font-size: 0.85rem;">How to restore from a backup</summary>
    <ol class="muted" style="font-size: 0.85rem; padding-left: 1.2rem; margin-top: 0.5rem;">
      <li>Stop the dev server (Ctrl+C in the terminal running <code>npm run dev</code>).</li>
      <li>In your project folder, copy the backup over the active DB:
        <pre style="background: var(--bg); padding: 0.5rem; border-radius: 4px; margin: 0.4rem 0; overflow-x: auto; font-size: 0.75rem;">cp data/backups/&lt;filename&gt; data/expenses.db</pre>
      </li>
      <li>Start the server again with <code>npm run dev</code>. Your data is back at that snapshot.</li>
    </ol>
    <p class="muted" style="font-size: 0.8rem; margin-top: 0.5rem;">
      Backups are just plain SQLite files — you can also copy them off the machine (email, USB, cloud) for safekeeping.
    </p>
  </details>
</div>

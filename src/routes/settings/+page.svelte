<script lang="ts">
  import { onMount } from 'svelte';
  import { flashToast } from '$lib/stores.js';

  let ollamaUrl = '';
  let ollamaModel = '';
  let status: { ok: boolean; reason?: string; models?: string[] } | null = null;
  let checking = false;
  let saving = false;

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

  onMount(load);

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

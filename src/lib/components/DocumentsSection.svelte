<script lang="ts">
  import { onMount } from 'svelte';
  import { flashToast } from '$lib/stores.js';
  import type { Document } from '$lib/types.js';

  export let activityId: number;

  let documents: Document[] = [];
  let dragOver = false;
  let uploading = false;
  let fileInput: HTMLInputElement;

  async function load() {
    if (!activityId) return;
    const r = await fetch(`/api/activities/${activityId}/documents`);
    if (r.ok) {
      const j = await r.json();
      documents = j.documents;
    }
  }

  onMount(load);
  $: if (activityId) load();

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    uploading = true;
    let okCount = 0;
    for (const f of files) {
      const form = new FormData();
      form.append('file', f);
      const r = await fetch(`/api/activities/${activityId}/documents`, { method: 'POST', body: form });
      if (r.ok) okCount++;
      else {
        const msg = await r.text();
        flashToast(`Upload failed: ${msg}`);
      }
    }
    uploading = false;
    if (okCount > 0) flashToast(`Uploaded ${okCount} file${okCount === 1 ? '' : 's'}`);
    await load();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    uploadFiles(e.dataTransfer?.files ?? null);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function onDragLeave() { dragOver = false; }

  function onPickFile() { fileInput.click(); }

  function onFileChange(e: Event) {
    const t = e.target as HTMLInputElement;
    uploadFiles(t.files);
    t.value = '';
  }

  async function removeDoc(d: Document) {
    if (!confirm(`Delete "${d.filename}"? This is permanent.`)) return;
    const r = await fetch(`/api/documents/${d.id}`, { method: 'DELETE' });
    if (r.ok) {
      flashToast('Document deleted');
      await load();
    }
  }

  function isImage(mime: string): boolean {
    return mime.startsWith('image/');
  }

  function iconFor(mime: string): string {
    if (mime === 'application/pdf') return 'PDF';
    if (mime.includes('word')) return 'DOC';
    if (mime.includes('sheet') || mime.includes('excel') || mime === 'text/csv') return 'CSV';
    if (mime.startsWith('text/')) return 'TXT';
    return 'FILE';
  }

  function formatSize(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }
</script>

<div
  class="doc-drop"
  class:dragover={dragOver}
  on:drop={onDrop}
  on:dragover={onDragOver}
  on:dragleave={onDragLeave}
  role="region"
  aria-label="Document upload"
>
  <input
    type="file"
    bind:this={fileInput}
    on:change={onFileChange}
    multiple
    style="display: none;"
    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md"
  />
  <button class="primary" on:click={onPickFile} disabled={uploading}>
    {uploading ? 'Uploading…' : 'Upload files'}
  </button>
  <span class="muted" style="font-size: 0.85rem; margin-left: 0.5rem;">
    or drag & drop images, PDFs, docs (max 10 MB each)
  </span>
</div>

{#if documents.length === 0}
  <p class="muted" style="font-size: 0.9rem; margin: 0.75rem 0 0;">No documents yet.</p>
{:else}
  <div class="doc-grid">
    {#each documents as d (d.id)}
      <div class="doc-card">
        {#if isImage(d.mime_type)}
          <a href="/api/documents/{d.id}" target="_blank" rel="noopener" class="doc-thumb-link">
            <img src="/api/documents/{d.id}" alt={d.filename} class="doc-thumb" loading="lazy" />
          </a>
        {:else}
          <a href="/api/documents/{d.id}?download=1" class="doc-thumb-link doc-thumb-icon">
            <span class="doc-icon">{iconFor(d.mime_type)}</span>
          </a>
        {/if}
        <div class="doc-meta">
          <div class="doc-name" title={d.filename}>{d.filename}</div>
          <div class="muted" style="font-size: 0.72rem;">{formatSize(d.size_bytes)}</div>
        </div>
        <div class="doc-actions">
          <a href="/api/documents/{d.id}?download=1" class="chip">⬇</a>
          <button class="danger" on:click={() => removeDoc(d)} title="Delete">×</button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .doc-drop {
    padding: 0.75rem;
    border: 1px dashed var(--border);
    border-radius: var(--radius);
    background: var(--bg-2);
    display: flex;
    align-items: center;
    transition: background 0.15s, border-color 0.15s;
  }
  .doc-drop.dragover {
    background: var(--bg-3);
    border-color: var(--accent);
  }
  .doc-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 0.75rem;
    margin-top: 0.75rem;
  }
  .doc-card {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .doc-thumb-link {
    display: block;
    aspect-ratio: 4 / 3;
    background: var(--bg);
    overflow: hidden;
  }
  .doc-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .doc-thumb-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .doc-icon {
    font-weight: 700;
    color: var(--text-dim);
    font-size: 1.1rem;
    letter-spacing: 0.1em;
  }
  .doc-meta {
    padding: 0.4rem 0.5rem 0.2rem;
  }
  .doc-name {
    font-size: 0.8rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .doc-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.25rem;
    padding: 0.25rem 0.4rem 0.4rem;
  }
  .doc-actions :global(.chip),
  .doc-actions button {
    padding: 0.15rem 0.5rem;
    font-size: 0.8rem;
    text-decoration: none;
  }
</style>

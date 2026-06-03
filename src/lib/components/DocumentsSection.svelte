<script lang="ts">
  import { onMount } from 'svelte';
  import { activities, refreshActivities, refreshActions, flashToast } from '$lib/stores.js';
  import { CATEGORIES, PERSONAL_CATEGORIES, formatMoney, parseMoney, todayIso } from '$lib/format.js';
  import type { Document, EntryKind } from '$lib/types.js';

  export let activityId: number;

  let documents: Document[] = [];
  let dragOver = false;
  let uploading = false;
  let fileInput: HTMLInputElement;

  let scanning: Record<number, boolean> = {};
  let showReview = false;
  let reviewDocId: number | null = null;
  let reviewActivityId: number = activityId;
  let reviewKind: EntryKind = 'EXPENSE';
  let reviewAmount = '';
  let reviewDate = todayIso();
  let reviewCategory = 'Other';
  let reviewNote = '';
  let reviewConfidence: 'high' | 'medium' | 'low' = 'medium';

  $: categoryOptions = (() => {
    const a = $activities.find((x) => x.id === reviewActivityId);
    const base = a?.type === 'PERSONAL' ? PERSONAL_CATEGORIES : CATEGORIES;
    const merged = new Set<string>(base);
    if (reviewCategory) merged.add(reviewCategory);
    return [...merged];
  })();

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

  async function scan(d: Document) {
    if ($activities.length === 0) await refreshActivities();
    scanning = { ...scanning, [d.id]: true };
    try {
      const r = await fetch(`/api/documents/${d.id}/scan`, { method: 'POST' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ message: 'Scan failed' }));
        flashToast(j.message ?? 'Scan failed');
        return;
      }
      const j = await r.json() as { document_id: number; activity_id: number; result: { vendor: string; date: string; total_cents: number; suggested_category: string; kind: EntryKind; notes: string; confidence: 'high' | 'medium' | 'low' } };
      reviewDocId = d.id;
      reviewActivityId = d.activity_id;
      reviewKind = j.result.kind;
      reviewAmount = (j.result.total_cents / 100).toFixed(2);
      reviewDate = j.result.date || todayIso();
      reviewCategory = j.result.suggested_category || 'Other';
      const vendor = j.result.vendor;
      reviewNote = [vendor, j.result.notes].filter(Boolean).join(' — ').slice(0, 200);
      reviewConfidence = j.result.confidence;
      showReview = true;
    } catch (e) {
      flashToast(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      scanning = { ...scanning, [d.id]: false };
    }
  }

  async function createEntryFromScan() {
    if (reviewDocId == null) return;
    const body = {
      activity_id: reviewActivityId,
      kind: reviewKind,
      amount_cents: parseMoney(reviewAmount),
      date: reviewDate,
      category: reviewCategory,
      note: reviewNote,
      recurrence: null
    };
    const r = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) { flashToast('Could not create entry'); return; }
    const j = await r.json() as { entry: { id: number } };
    await fetch(`/api/documents/${reviewDocId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entry_id: j.entry.id })
    });
    flashToast('Entry created and linked');
    showReview = false;
    await refreshActions();
  }

  function canScan(d: Document): boolean {
    return d.mime_type.startsWith('image/') && !d.entry_id;
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
          {#if canScan(d)}
            <button on:click={() => scan(d)} disabled={!!scanning[d.id]} title="Extract expense data with local AI">
              {scanning[d.id] ? '…' : '🔍 Scan'}
            </button>
          {:else if d.entry_id}
            <span class="chip" title="Already linked to an entry">linked</span>
          {/if}
          <a href="/api/documents/{d.id}?download=1" class="chip">⬇</a>
          <button class="danger" on:click={() => removeDoc(d)} title="Delete">×</button>
        </div>
      </div>
    {/each}
  </div>
{/if}

{#if showReview && reviewDocId != null}
  <div class="modal-bg" on:click|self={() => (showReview = false)} role="dialog">
    <div class="modal">
      <h3 style="margin-top: 0;">Review extracted data</h3>
      <p class="muted" style="font-size: 0.85rem;">
        Confidence: <span class="chip" style="background: {reviewConfidence === 'high' ? 'var(--good)' : reviewConfidence === 'low' ? 'var(--bad)' : 'var(--warn)'}; color: white;">{reviewConfidence}</span>
        — review and edit before creating the entry.
      </p>
      <div class="col">
        <div>
          <label>Activity</label>
          <select bind:value={reviewActivityId}>
            {#each $activities as a}<option value={a.id}>{a.name}</option>{/each}
          </select>
        </div>
        <div>
          <label>Kind</label>
          <select bind:value={reviewKind}>
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </div>
        <div>
          <label>Amount (USD)</label>
          <input type="text" inputmode="decimal" bind:value={reviewAmount} />
        </div>
        <div>
          <label>Date</label>
          <input type="date" bind:value={reviewDate} />
        </div>
        <div>
          <label>Category</label>
          <select bind:value={reviewCategory}>
            {#each categoryOptions as c}<option value={c}>{c}</option>{/each}
          </select>
        </div>
        <div>
          <label>Note</label>
          <input bind:value={reviewNote} />
        </div>
        <div class="row" style="margin-top: 0.5rem;">
          <button on:click={() => (showReview = false)}>Cancel</button>
          <button class="primary right" on:click={createEntryFromScan} disabled={!reviewAmount.trim()}>
            Create entry & link
          </button>
        </div>
      </div>
    </div>
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

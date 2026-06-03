<script lang="ts">
  import { activities, refreshActivities, flashToast, refreshActions } from '$lib/stores.js';
  import { ACTIVITY_COLORS } from '$lib/format.js';
  import { ALL_TYPES, TYPE_LABELS, TYPE_DESCRIPTIONS } from '$lib/activityTypes.js';
  import type { ActivityType } from '$lib/types.js';

  let showForm = false;
  let editingId: number | null = null;
  let name = '';
  let type: ActivityType = 'AIRBNB';
  let color = ACTIVITY_COLORS[0];
  let notes = '';

  function openCreate() {
    editingId = null;
    name = '';
    type = 'AIRBNB';
    color = ACTIVITY_COLORS[0];
    notes = '';
    showForm = true;
  }

  function openEdit(a: (typeof $activities)[number]) {
    editingId = a.id;
    name = a.name;
    type = a.type;
    color = a.color;
    notes = a.notes;
    showForm = true;
  }

  async function save() {
    const body = { name, type, color, notes };
    if (editingId == null) {
      await fetch('/api/activities', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      flashToast('Activity created');
    } else {
      await fetch(`/api/activities/${editingId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      flashToast('Activity updated');
    }
    showForm = false;
    await refreshActivities();
    await refreshActions();
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Delete "${name}" and all its entries? (You can undo.)`)) return;
    await fetch(`/api/activities/${id}`, { method: 'DELETE' });
    flashToast('Activity deleted');
    await refreshActivities();
    await refreshActions();
  }
</script>

<section class="section-header">
  <h2>Activities</h2>
  <button class="primary right" on:click={openCreate}>+ New activity</button>
</section>

{#if $activities.length === 0}
  <div class="card">
    <p class="muted">No activities yet. Add one to start tracking expenses.</p>
  </div>
{:else}
  <div class="card" style="padding: 0;">
    <table class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Notes</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each $activities as a (a.id)}
          <tr>
            <td>
              <span class="color-dot" style="background: {a.color}; margin-right: 0.4rem;"></span>
              <a href="/activities/{a.id}">{a.name}</a>
            </td>
            <td><span class="chip">{TYPE_LABELS[a.type]}</span></td>
            <td class="muted">{a.notes || ''}</td>
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
      <h3>{editingId == null ? 'New activity' : 'Edit activity'}</h3>
      <div class="col">
        <div>
          <label>Name</label>
          <input bind:value={name} placeholder="e.g. Lake House" />
        </div>
        <div>
          <label>Type</label>
          <select bind:value={type}>
            {#each ALL_TYPES as t}
              <option value={t}>{TYPE_LABELS[t]} — {TYPE_DESCRIPTIONS[t]}</option>
            {/each}
          </select>
        </div>
        <div>
          <label>Color</label>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            {#each ACTIVITY_COLORS as c}
              <button
                type="button"
                aria-label="Pick color {c}"
                aria-pressed={color === c}
                on:click={() => (color = c)}
                style="
                  width: 2rem;
                  height: 2rem;
                  border-radius: 50%;
                  background: {c};
                  padding: 0;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-size: 1rem;
                  font-weight: 700;
                  border: 3px solid {color === c ? 'var(--text)' : 'transparent'};
                  outline: {color === c ? '2px solid ' + c : 'none'};
                  outline-offset: 1px;
                "
              >{color === c ? '✓' : ''}</button>
            {/each}
          </div>
        </div>
        <div>
          <label>Notes</label>
          <textarea bind:value={notes} rows="2" placeholder="optional"></textarea>
        </div>
        <div class="row" style="margin-top: 0.5rem;">
          <button on:click={() => (showForm = false)}>Cancel</button>
          <button class="primary right" on:click={save} disabled={!name.trim()}>Save</button>
        </div>
      </div>
    </div>
  </div>
{/if}

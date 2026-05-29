<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { canUndo, canRedo, doUndo, doRedo, refreshAll, toast } from '$lib/stores.js';

  onMount(() => {
    refreshAll();
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); doRedo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  $: path = $page.url.pathname;
  function isActive(p: string) { return path === p || (p !== '/' && path.startsWith(p)); }
</script>

<div class="app-shell">
  <header class="app-header">
    <span class="app-title">Expense Dashboard</span>
    <nav class="nav">
      <a href="/" class:active={isActive('/')}>Overview</a>
      <a href="/activities" class:active={isActive('/activities')}>Activities</a>
      <a href="/calendar"   class:active={isActive('/calendar')}>Calendar</a>
      <a href="/accounts"   class:active={isActive('/accounts')}>Accounts</a>
      <a href="/history"    class:active={isActive('/history')}>History</a>
    </nav>
    <div class="toolbar">
      <button on:click={doUndo} disabled={!$canUndo} title="Undo (Ctrl+Z)">↶ Undo</button>
      <button on:click={doRedo} disabled={!$canRedo} title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
    </div>
  </header>

  <main class="app-main">
    <slot />
  </main>

  {#if $toast}
    <div class="toast">{$toast}</div>
  {/if}
</div>

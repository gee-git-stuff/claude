<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables, type ChartConfiguration, type ChartData, type ChartType } from 'chart.js';

  Chart.register(...registerables);
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.borderColor = '#334155';
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  export let type: ChartType;
  export let data: ChartData;
  export let options: ChartConfiguration['options'] = {};
  export let height = 260;

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  onMount(() => {
    chart = new Chart(canvas, { type, data, options: { responsive: true, maintainAspectRatio: false, ...options } });
  });

  onDestroy(() => chart?.destroy());

  $: if (chart) {
    chart.data = data;
    chart.options = { responsive: true, maintainAspectRatio: false, ...(options ?? {}) };
    chart.update();
  }
</script>

<div style="position: relative; height: {height}px; width: 100%;">
  <canvas bind:this={canvas}></canvas>
</div>

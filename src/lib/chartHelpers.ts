import type { Activity, CategoryRow, MonthlyRow } from './types.js';
import { formatMoney } from './format.js';

export function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

export function netOverTimeData(
  labels: string[],
  monthly: MonthlyRow[],
  activities: Activity[]
) {
  const byActivity = new Map<number, Map<string, number>>();
  for (const row of monthly) {
    if (!byActivity.has(row.activity_id)) byActivity.set(row.activity_id, new Map());
    byActivity.get(row.activity_id)!.set(row.month, row.income_cents - row.expense_cents);
  }
  return {
    labels: labels.map(formatMonthLabel),
    datasets: activities.map((a) => ({
      label: a.name,
      data: labels.map((m) => (byActivity.get(a.id)?.get(m) ?? 0) / 100),
      borderColor: a.color,
      backgroundColor: hexToRgba(a.color, 0.15),
      tension: 0.2,
      fill: false,
      pointRadius: 2
    }))
  };
}

export function profitabilityBarData(monthly: MonthlyRow[], activities: Activity[]) {
  const totals = new Map<number, number>();
  for (const row of monthly) {
    totals.set(row.activity_id, (totals.get(row.activity_id) ?? 0) + (row.income_cents - row.expense_cents));
  }
  const sorted = [...activities].sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0));
  return {
    labels: sorted.map((a) => a.name),
    datasets: [{
      label: 'Net',
      data: sorted.map((a) => (totals.get(a.id) ?? 0) / 100),
      backgroundColor: sorted.map((a) => a.color),
      borderColor: sorted.map((a) => a.color),
      borderWidth: 0
    }]
  };
}

export function categoryDoughnutData(categories: CategoryRow[], kind: 'EXPENSE' | 'INCOME', activityIds: Set<number> | null) {
  const totals = new Map<string, number>();
  for (const row of categories) {
    if (row.kind !== kind) continue;
    if (activityIds && !activityIds.has(row.activity_id)) continue;
    totals.set(row.category, (totals.get(row.category) ?? 0) + row.amount_cents);
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 8);
  const otherTotal = sorted.slice(8).reduce((s, [, v]) => s + v, 0);
  if (otherTotal > 0) top.push(['Other', otherTotal]);
  const palette = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
  return {
    labels: top.map(([c]) => c),
    datasets: [{
      data: top.map(([, v]) => v / 100),
      backgroundColor: top.map((_, i) => palette[i % palette.length]),
      borderColor: '#1e293b',
      borderWidth: 2
    }]
  };
}

export function monthlyIncomeExpenseData(labels: string[], monthly: MonthlyRow[], activityId: number) {
  const byMonth = new Map<string, { income: number; expense: number }>();
  for (const m of labels) byMonth.set(m, { income: 0, expense: 0 });
  for (const row of monthly) {
    if (row.activity_id !== activityId) continue;
    const bucket = byMonth.get(row.month);
    if (!bucket) continue;
    bucket.income += row.income_cents;
    bucket.expense += row.expense_cents;
  }
  return {
    labels: labels.map(formatMonthLabel),
    datasets: [
      {
        label: 'Income',
        data: labels.map((m) => (byMonth.get(m)?.income ?? 0) / 100),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: '#10b981',
        borderWidth: 0
      },
      {
        label: 'Expenses',
        data: labels.map((m) => -(byMonth.get(m)?.expense ?? 0) / 100),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: '#ef4444',
        borderWidth: 0
      }
    ]
  };
}

export function moneyTooltip() {
  return {
    callbacks: {
      label: (ctx: { dataset: { label?: string }; parsed: { y?: number; x?: number } | number }) => {
        const raw = typeof ctx.parsed === 'number' ? ctx.parsed : (ctx.parsed.y ?? ctx.parsed.x ?? 0);
        const label = (ctx.dataset.label ? ctx.dataset.label + ': ' : '');
        return label + formatMoney(Math.round(raw * 100));
      }
    }
  };
}

export function moneyAxis() {
  return {
    ticks: {
      callback: (v: string | number) => formatMoney(Math.round(Number(v) * 100))
    }
  };
}

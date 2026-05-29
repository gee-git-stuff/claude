import { db } from './db.js';
import type { CategoryRow, MonthlyRow } from '../types.js';

function cutoffIso(months: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - (months - 1));
  return d.toISOString().slice(0, 10);
}

export function monthlyTimeseries(months: number): MonthlyRow[] {
  const rows = db.prepare(`
    SELECT
      strftime('%Y-%m', date) AS month,
      activity_id,
      COALESCE(SUM(CASE WHEN kind = 'INCOME'  THEN amount_cents ELSE 0 END), 0) AS income_cents,
      COALESCE(SUM(CASE WHEN kind = 'EXPENSE' THEN amount_cents ELSE 0 END), 0) AS expense_cents
    FROM entries
    WHERE date >= ?
    GROUP BY month, activity_id
    ORDER BY month, activity_id
  `).all(cutoffIso(months)) as unknown as Array<{ month: string; activity_id: number; income_cents: number | bigint; expense_cents: number | bigint }>;
  return rows.map((r) => ({
    month: r.month,
    activity_id: r.activity_id,
    income_cents: Number(r.income_cents),
    expense_cents: Number(r.expense_cents)
  }));
}

export function categoryBreakdown(months: number): CategoryRow[] {
  const rows = db.prepare(`
    SELECT
      activity_id,
      category,
      kind,
      COALESCE(SUM(amount_cents), 0) AS amount_cents
    FROM entries
    WHERE date >= ?
    GROUP BY activity_id, category, kind
    ORDER BY amount_cents DESC
  `).all(cutoffIso(months)) as unknown as Array<{ activity_id: number; category: string; kind: 'EXPENSE' | 'INCOME'; amount_cents: number | bigint }>;
  return rows.map((r) => ({
    activity_id: r.activity_id,
    category: r.category || 'Uncategorized',
    kind: r.kind,
    amount_cents: Number(r.amount_cents)
  }));
}

export function monthLabels(months: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - (months - 1));
  for (let i = 0; i < months; i++) {
    out.push(d.toISOString().slice(0, 7));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

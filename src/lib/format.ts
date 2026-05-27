const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2
});

export function formatMoney(cents: number): string {
  return usd.format(cents / 100);
}

export function parseMoney(input: string): number {
  const cleaned = input.replace(/[^0-9.\-]/g, '');
  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const ACTIVITY_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6',
  '#ec4899', '#64748b'
];

export const CATEGORIES = [
  'Mortgage', 'Rent', 'Utilities', 'Internet', 'Cleaning', 'Maintenance',
  'Insurance', 'Taxes', 'Supplies', 'Fees', 'Marketing', 'Mileage',
  'Income', 'Booking', 'Other'
];

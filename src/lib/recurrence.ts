import type { RecurrenceFrequency } from './types.js';

export function stepForward(d: Date, freq: RecurrenceFrequency, interval: number): Date {
  const out = new Date(d);
  switch (freq) {
    case 'DAILY':   out.setUTCDate(out.getUTCDate() + interval); break;
    case 'WEEKLY':  out.setUTCDate(out.getUTCDate() + 7 * interval); break;
    case 'MONTHLY': out.setUTCMonth(out.getUTCMonth() + interval); break;
    case 'ANNUAL':  out.setUTCFullYear(out.getUTCFullYear() + interval); break;
  }
  return out;
}

export function nextOccurrence(startIso: string, freq: RecurrenceFrequency, interval: number, from: Date = new Date()): Date | null {
  if (interval <= 0) return null;
  let d = new Date(startIso + 'T00:00:00Z');
  const fromUtc = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  let safety = 50000;
  while (d < fromUtc && safety-- > 0) {
    d = stepForward(d, freq, interval);
  }
  return safety > 0 ? d : null;
}

export function monthlyAmountCents(amountCents: number, freq: RecurrenceFrequency, interval: number): number {
  if (interval <= 0) return 0;
  switch (freq) {
    case 'DAILY':   return Math.round((amountCents * 30.4375) / interval);
    case 'WEEKLY':  return Math.round((amountCents * 4.345) / interval);
    case 'MONTHLY': return Math.round(amountCents / interval);
    case 'ANNUAL':  return Math.round(amountCents / (12 * interval));
  }
}

export function freqLabel(freq: RecurrenceFrequency, interval: number): string {
  const unit = freq === 'DAILY' ? 'day' : freq === 'WEEKLY' ? 'week' : freq === 'MONTHLY' ? 'month' : 'year';
  return interval === 1 ? `every ${unit}` : `every ${interval} ${unit}s`;
}

interface RecurringLike {
  date: string;
  recurrence: { frequency: RecurrenceFrequency; interval: number; end_date: string | null } | null;
}

export function upcomingOccurrences<T extends RecurringLike>(
  items: T[],
  daysAhead: number
): Array<{ date: string; item: T }> {
  const today = new Date();
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + daysAhead);
  const horizonIso = horizon.toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);

  const out: Array<{ date: string; item: T }> = [];
  for (const item of items) {
    if (!item.recurrence) {
      if (item.date >= todayIso && item.date <= horizonIso) {
        out.push({ date: item.date, item });
      }
      continue;
    }
    const { frequency, interval, end_date } = item.recurrence;
    let d = nextOccurrence(item.date, frequency, interval, today);
    let safety = 2000;
    while (d && safety-- > 0) {
      const iso = d.toISOString().slice(0, 10);
      if (iso > horizonIso) break;
      if (end_date && iso > end_date) break;
      out.push({ date: iso, item });
      d = stepForward(d, frequency, interval);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

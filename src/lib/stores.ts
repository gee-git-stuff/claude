import { writable } from 'svelte/store';
import type { Account, Activity, ActivityTotals, BankTransactionWithLink, CalendarEvent, ChartsResponse, EntryWithRecurrence } from './types.js';

export const activities      = writable<Activity[]>([]);
export const totals          = writable<ActivityTotals[]>([]);
export const entries         = writable<EntryWithRecurrence[]>([]);
export const accounts        = writable<Account[]>([]);
export const transactions    = writable<BankTransactionWithLink[]>([]);
export const charts          = writable<ChartsResponse | null>(null);
export const calendarEvents  = writable<CalendarEvent[]>([]);
export const canUndo         = writable(false);
export const canRedo         = writable(false);
export const toast           = writable<string | null>(null);

let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function flashToast(msg: string) {
  toast.set(msg);
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.set(null), 2200);
}

export async function refreshAll() {
  await Promise.all([refreshActivities(), refreshEntries(), refreshAccounts(), refreshActions()]);
}

export async function refreshCharts(months: number) {
  const r = await fetch(`/api/charts?months=${months}`);
  const j = await r.json();
  charts.set(j);
}

export async function refreshCalendar(from?: string, to?: string) {
  const qs = from && to ? `?from=${from}&to=${to}` : '';
  const r = await fetch(`/api/calendar${qs}`);
  const j = await r.json();
  calendarEvents.set(j.events);
}

export async function refreshActivities() {
  const r = await fetch('/api/activities');
  const j = await r.json();
  activities.set(j.activities);
  totals.set(j.totals);
}

export async function refreshEntries(activityId?: number) {
  const url = activityId != null ? `/api/entries?activity_id=${activityId}` : '/api/entries';
  const r = await fetch(url);
  const j = await r.json();
  entries.set(j.entries);
}

export async function refreshAccounts() {
  const r = await fetch('/api/accounts');
  const j = await r.json();
  accounts.set(j.accounts);
}

export async function refreshTransactions(accountId: number) {
  const r = await fetch(`/api/transactions?account_id=${accountId}`);
  const j = await r.json();
  transactions.set(j.transactions);
}

export async function refreshActions() {
  const r = await fetch('/api/actions');
  const j = await r.json();
  canUndo.set(j.canUndo);
  canRedo.set(j.canRedo);
}

export async function doUndo() {
  const r = await fetch('/api/actions/undo', { method: 'POST' });
  const j = await r.json();
  if (j.undone) flashToast(`Undid: ${j.summary}`);
  else flashToast('Nothing to undo');
  await refreshAll();
}

export async function doRedo() {
  const r = await fetch('/api/actions/redo', { method: 'POST' });
  const j = await r.json();
  if (j.redone) flashToast(`Redid: ${j.summary}`);
  else flashToast('Nothing to redo');
  await refreshAll();
}

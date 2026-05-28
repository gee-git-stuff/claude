import { error, json } from '@sveltejs/kit';
import { importTxns } from '$lib/server/transactions.js';
import { getAccount, saveMapping } from '$lib/server/accounts.js';
import type { CsvMapping } from '$lib/types.js';

export async function POST({ params, request }: { params: { id: string }; request: Request }) {
  const id = Number(params.id);
  if (!getAccount(id)) throw error(404, 'Account not found');

  const body = await request.json();
  const txns = Array.isArray(body.transactions) ? body.transactions : [];
  const newBalance = Number(body.new_balance_cents ?? 0);
  const mapping: CsvMapping | undefined = body.mapping;

  if (mapping) saveMapping(id, mapping);

  const result = importTxns(id, txns.map((t: { date: string; amount_cents: number; description: string; raw_row: string }) => ({
    date: String(t.date),
    amount_cents: Math.round(Number(t.amount_cents) || 0),
    description: String(t.description ?? ''),
    raw_row: String(t.raw_row ?? '')
  })), newBalance);

  return json(result);
}

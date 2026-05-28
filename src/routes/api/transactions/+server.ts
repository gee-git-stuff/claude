import { error, json } from '@sveltejs/kit';
import { listTxns } from '$lib/server/transactions.js';

export async function GET({ url }: { url: URL }) {
  const accountParam = url.searchParams.get('account_id');
  if (!accountParam) throw error(400, 'account_id required');
  return json({ transactions: listTxns(Number(accountParam)) });
}

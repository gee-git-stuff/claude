import { error, json } from '@sveltejs/kit';
import { getAccount, saveMapping } from '$lib/server/accounts.js';
import type { CsvMapping } from '$lib/types.js';

export async function PUT({ params, request }: { params: { id: string }; request: Request }) {
  const id = Number(params.id);
  if (!getAccount(id)) throw error(404, 'Account not found');
  const body = await request.json();
  const mapping = body as CsvMapping;
  saveMapping(id, mapping);
  return json({ ok: true });
}

import { error, json } from '@sveltejs/kit';
import { deleteAccount, updateAccount } from '$lib/server/accounts.js';
import type { AccountType } from '$lib/types.js';

export async function PATCH({ params, request }: { params: { id: string }; request: Request }) {
  const id = Number(params.id);
  const body = await request.json();
  const account = updateAccount(id, {
    name: String(body.name ?? '').trim() || 'Untitled',
    type: (body.type as AccountType) ?? 'CHECKING',
    balance_cents: Number(body.balance_cents ?? 0),
    notes: String(body.notes ?? '')
  });
  if (!account) throw error(404, 'Not found');
  return json({ account });
}

export async function DELETE({ params }: { params: { id: string } }) {
  const ok = deleteAccount(Number(params.id));
  if (!ok) throw error(404, 'Not found');
  return json({ ok: true });
}

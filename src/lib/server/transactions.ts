import { db } from './db.js';
import { recordAction } from './actions.js';
import { getAccount, setBalanceSilent } from './accounts.js';
import type { BankTransaction } from '../types.js';

export function listTxns(accountId: number): BankTransaction[] {
  return db.prepare(`
    SELECT * FROM bank_txns WHERE account_id = ? ORDER BY date DESC, id DESC
  `).all(accountId) as BankTransaction[];
}

export function getTxn(id: number): BankTransaction | undefined {
  return db.prepare(`SELECT * FROM bank_txns WHERE id = ?`).get(id) as BankTransaction | undefined;
}

interface TxnInput {
  date: string;
  amount_cents: number;
  description: string;
  raw_row: string;
}

export interface ImportResult {
  inserted: number;
  skipped: number;
  new_balance_cents: number;
  txn_ids: number[];
}

export function importTxns(accountId: number, txns: TxnInput[], newBalanceCents: number): ImportResult {
  const account = getAccount(accountId);
  if (!account) return { inserted: 0, skipped: 0, new_balance_cents: 0, txn_ids: [] };

  const oldBalance = account.balance_cents;
  const existing = db.prepare(`SELECT raw_row FROM bank_txns WHERE account_id = ?`).all(accountId) as Array<{ raw_row: string }>;
  const seen = new Set(existing.map((r) => r.raw_row));

  const insert = db.prepare(`
    INSERT INTO bank_txns (account_id, date, amount_cents, description, raw_row)
    VALUES (?, ?, ?, ?, ?)
  `);

  const ids: number[] = [];
  const insertedTxns: Array<TxnInput & { id: number }> = [];
  let skipped = 0;

  const tx = db.transaction(() => {
    for (const t of txns) {
      if (t.raw_row && seen.has(t.raw_row)) { skipped++; continue; }
      const r = insert.run(accountId, t.date, t.amount_cents, t.description, t.raw_row);
      const id = Number(r.lastInsertRowid);
      ids.push(id);
      insertedTxns.push({ ...t, id });
    }
    setBalanceSilent(accountId, newBalanceCents);
  });
  tx();

  recordAction({
    kind: 'IMPORT_TXNS',
    summary: `Imported ${ids.length} transaction${ids.length === 1 ? '' : 's'} to "${account.name}"`,
    forward: { account_id: accountId, txns: insertedTxns, new_balance: newBalanceCents },
    reverse: { account_id: accountId, txn_ids: ids, old_balance: oldBalance }
  });

  return { inserted: ids.length, skipped, new_balance_cents: newBalanceCents, txn_ids: ids };
}

export function deleteTxn(id: number): boolean {
  const before = getTxn(id);
  if (!before) return false;
  db.prepare(`DELETE FROM bank_txns WHERE id = ?`).run(id);
  recordAction({
    kind: 'DELETE_TXN',
    summary: `Deleted transaction "${before.description || 'untitled'}"`,
    forward: { id },
    reverse: { txn: before }
  });
  return true;
}

interface TxnPayload {
  id?: number;
  account_id?: number;
  txn?: BankTransaction;
  txns?: Array<TxnInput & { id: number }>;
  txn_ids?: number[];
  new_balance?: number;
  old_balance?: number;
}

export function applyTxnForward(kind: string, payload: TxnPayload) {
  switch (kind) {
    case 'IMPORT_TXNS': {
      if (payload.account_id == null || !payload.txns) return;
      const insert = db.prepare(`
        INSERT INTO bank_txns (id, account_id, date, amount_cents, description, raw_row)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const tx = db.transaction(() => {
        for (const t of payload.txns!) {
          insert.run(t.id, payload.account_id, t.date, t.amount_cents, t.description, t.raw_row);
        }
        if (payload.new_balance != null) setBalanceSilent(payload.account_id!, payload.new_balance);
      });
      tx();
      return;
    }
    case 'DELETE_TXN': {
      if (payload.id == null) return;
      db.prepare(`DELETE FROM bank_txns WHERE id = ?`).run(payload.id);
      return;
    }
  }
}

export function applyTxnReverse(kind: string, payload: TxnPayload) {
  switch (kind) {
    case 'IMPORT_TXNS': {
      if (payload.account_id == null || !payload.txn_ids) return;
      const del = db.prepare(`DELETE FROM bank_txns WHERE id = ?`);
      const tx = db.transaction(() => {
        for (const id of payload.txn_ids!) del.run(id);
        if (payload.old_balance != null) setBalanceSilent(payload.account_id!, payload.old_balance);
      });
      tx();
      return;
    }
    case 'DELETE_TXN': {
      if (!payload.txn) return;
      const t = payload.txn;
      db.prepare(`
        INSERT INTO bank_txns (id, account_id, date, amount_cents, description, raw_row, entry_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(t.id, t.account_id, t.date, t.amount_cents, t.description, t.raw_row, t.entry_id, t.created_at);
      return;
    }
  }
}

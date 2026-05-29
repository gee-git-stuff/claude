import { db, transaction } from './db.js';
import { recordAction } from './actions.js';
import { getAccount, setBalanceSilent } from './accounts.js';
import type { BankTransaction, BankTransactionWithLink, Entry, EntryKind } from '../types.js';

export function listTxns(accountId: number): BankTransactionWithLink[] {
  const rows = db.prepare(`
    SELECT
      t.*,
      e.id           AS e_id,
      e.activity_id  AS e_activity_id,
      e.category     AS e_category,
      a.name         AS a_name,
      a.color        AS a_color
    FROM bank_txns t
    LEFT JOIN entries    e ON e.id = t.entry_id
    LEFT JOIN activities a ON a.id = e.activity_id
    WHERE t.account_id = ?
    ORDER BY t.date DESC, t.id DESC
  `).all(accountId) as unknown as Array<BankTransaction & {
    e_id: number | null; e_activity_id: number | null; e_category: string | null;
    a_name: string | null; a_color: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id, account_id: r.account_id, date: r.date, amount_cents: r.amount_cents,
    description: r.description, raw_row: r.raw_row, entry_id: r.entry_id, created_at: r.created_at,
    link: r.e_id != null && r.e_activity_id != null
      ? { entry_id: r.e_id, activity_id: r.e_activity_id, activity_name: r.a_name ?? '', activity_color: r.a_color ?? '#3b82f6', category: r.e_category ?? '' }
      : null
  }));
}

export function getTxn(id: number): BankTransaction | undefined {
  return db.prepare(`SELECT * FROM bank_txns WHERE id = ?`).get(id) as unknown as BankTransaction | undefined;
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

  const tx = transaction(() => {
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

interface TagInput {
  activity_id: number;
  category: string;
  note: string;
}

export interface TagResult {
  ok: boolean;
  entry_id?: number;
  reason?: string;
}

export function tagTransaction(txnId: number, input: TagInput): TagResult {
  const txn = getTxn(txnId);
  if (!txn) return { ok: false, reason: 'Transaction not found' };
  if (txn.entry_id != null) return { ok: false, reason: 'Already tagged' };

  const kind: EntryKind = txn.amount_cents >= 0 ? 'INCOME' : 'EXPENSE';
  const amount = Math.abs(txn.amount_cents);
  let newEntryId = 0;

  transaction(() => {
    const r = db.prepare(`
      INSERT INTO entries (activity_id, kind, amount_cents, date, category, note, bank_txn_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(input.activity_id, kind, amount, txn.date, input.category, input.note, txnId);
    newEntryId = Number(r.lastInsertRowid);
    db.prepare(`UPDATE bank_txns SET entry_id = ? WHERE id = ?`).run(newEntryId, txnId);
  })();

  const entry = db.prepare(`SELECT * FROM entries WHERE id = ?`).get(newEntryId) as unknown as Entry;

  recordAction({
    kind: 'TAG_TXN',
    summary: `Tagged "${txn.description}" → ${input.category}`,
    forward: { txn_id: txnId, entry },
    reverse: { txn_id: txnId, entry_id: newEntryId }
  });

  return { ok: true, entry_id: newEntryId };
}

export function untagTransaction(txnId: number): TagResult {
  const txn = getTxn(txnId);
  if (!txn) return { ok: false, reason: 'Transaction not found' };
  if (txn.entry_id == null) return { ok: false, reason: 'Not tagged' };

  const entry = db.prepare(`SELECT * FROM entries WHERE id = ?`).get(txn.entry_id) as unknown as Entry | undefined;
  if (!entry) {
    db.prepare(`UPDATE bank_txns SET entry_id = NULL WHERE id = ?`).run(txnId);
    return { ok: true };
  }

  transaction(() => {
    db.prepare(`DELETE FROM entries WHERE id = ?`).run(entry.id);
    db.prepare(`UPDATE bank_txns SET entry_id = NULL WHERE id = ?`).run(txnId);
  })();

  recordAction({
    kind: 'UNTAG_TXN',
    summary: `Untagged "${txn.description}"`,
    forward: { txn_id: txnId, entry_id: entry.id },
    reverse: { txn_id: txnId, entry }
  });

  return { ok: true };
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
  txn_id?: number;
  entry?: Entry;
  entry_id?: number;
}

export function applyTxnForward(kind: string, payload: TxnPayload) {
  switch (kind) {
    case 'IMPORT_TXNS': {
      if (payload.account_id == null || !payload.txns) return;
      const accountId = payload.account_id;
      const txns = payload.txns;
      const newBalance = payload.new_balance;
      const insert = db.prepare(`
        INSERT INTO bank_txns (id, account_id, date, amount_cents, description, raw_row)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const tx = transaction(() => {
        for (const t of txns) {
          insert.run(t.id, accountId, t.date, t.amount_cents, t.description, t.raw_row);
        }
        if (newBalance != null) setBalanceSilent(accountId, newBalance);
      });
      tx();
      return;
    }
    case 'DELETE_TXN': {
      if (payload.id == null) return;
      db.prepare(`DELETE FROM bank_txns WHERE id = ?`).run(payload.id);
      return;
    }
    case 'TAG_TXN': {
      if (payload.txn_id == null || !payload.entry) return;
      const e = payload.entry;
      const txnId = payload.txn_id;
      transaction(() => {
        db.prepare(`
          INSERT INTO entries (id, activity_id, kind, amount_cents, date, category, note, recurrence_id, bank_txn_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(e.id, e.activity_id, e.kind, e.amount_cents, e.date, e.category, e.note, e.recurrence_id, e.bank_txn_id, e.created_at);
        db.prepare(`UPDATE bank_txns SET entry_id = ? WHERE id = ?`).run(e.id, txnId);
      })();
      return;
    }
    case 'UNTAG_TXN': {
      if (payload.txn_id == null || payload.entry_id == null) return;
      const txnId = payload.txn_id;
      const entryId = payload.entry_id;
      transaction(() => {
        db.prepare(`DELETE FROM entries WHERE id = ?`).run(entryId);
        db.prepare(`UPDATE bank_txns SET entry_id = NULL WHERE id = ?`).run(txnId);
      })();
      return;
    }
  }
}

export function applyTxnReverse(kind: string, payload: TxnPayload) {
  switch (kind) {
    case 'IMPORT_TXNS': {
      if (payload.account_id == null || !payload.txn_ids) return;
      const accountId = payload.account_id;
      const txnIds = payload.txn_ids;
      const oldBalance = payload.old_balance;
      const del = db.prepare(`DELETE FROM bank_txns WHERE id = ?`);
      const tx = transaction(() => {
        for (const id of txnIds) del.run(id);
        if (oldBalance != null) setBalanceSilent(accountId, oldBalance);
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
    case 'TAG_TXN': {
      if (payload.txn_id == null || payload.entry_id == null) return;
      const txnId = payload.txn_id;
      const entryId = payload.entry_id;
      transaction(() => {
        db.prepare(`DELETE FROM entries WHERE id = ?`).run(entryId);
        db.prepare(`UPDATE bank_txns SET entry_id = NULL WHERE id = ?`).run(txnId);
      })();
      return;
    }
    case 'UNTAG_TXN': {
      if (payload.txn_id == null || !payload.entry) return;
      const e = payload.entry;
      const txnId = payload.txn_id;
      transaction(() => {
        db.prepare(`
          INSERT INTO entries (id, activity_id, kind, amount_cents, date, category, note, recurrence_id, bank_txn_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(e.id, e.activity_id, e.kind, e.amount_cents, e.date, e.category, e.note, e.recurrence_id, e.bank_txn_id, e.created_at);
        db.prepare(`UPDATE bank_txns SET entry_id = ? WHERE id = ?`).run(e.id, txnId);
      })();
      return;
    }
  }
}

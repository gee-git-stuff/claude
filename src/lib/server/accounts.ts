import { db } from './db.js';
import { recordAction } from './actions.js';
import type { Account, AccountType } from '../types.js';

interface AccountInput {
  name: string;
  type: AccountType;
  balance_cents: number;
  notes: string;
}

export function listAccounts(): Account[] {
  return db.prepare(`SELECT * FROM accounts ORDER BY type, name`).all() as Account[];
}

export function getAccount(id: number): Account | undefined {
  return db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(id) as Account | undefined;
}

export function createAccount(input: AccountInput): Account {
  const result = db.prepare(`
    INSERT INTO accounts (name, type, balance_cents, notes) VALUES (?, ?, ?, ?)
  `).run(input.name, input.type, input.balance_cents, input.notes);
  const id = Number(result.lastInsertRowid);
  const account = getAccount(id)!;
  recordAction({
    kind: 'CREATE_ACCOUNT',
    summary: `Added account "${input.name}"`,
    forward: { id, input },
    reverse: { id }
  });
  return account;
}

export function updateAccount(id: number, input: AccountInput): Account | undefined {
  const before = getAccount(id);
  if (!before) return undefined;
  db.prepare(`
    UPDATE accounts SET name = ?, type = ?, balance_cents = ?, notes = ?, updated_at = datetime('now') WHERE id = ?
  `).run(input.name, input.type, input.balance_cents, input.notes, id);
  const after = getAccount(id)!;
  recordAction({
    kind: 'UPDATE_ACCOUNT',
    summary: `Updated account "${after.name}"`,
    forward: { id, input },
    reverse: { id, input: { name: before.name, type: before.type, balance_cents: before.balance_cents, notes: before.notes } }
  });
  return after;
}

export function deleteAccount(id: number): boolean {
  const before = getAccount(id);
  if (!before) return false;
  db.prepare(`DELETE FROM accounts WHERE id = ?`).run(id);
  recordAction({
    kind: 'DELETE_ACCOUNT',
    summary: `Deleted account "${before.name}"`,
    forward: { id },
    reverse: { account: before }
  });
  return true;
}

export function applyAccountForward(kind: string, payload: { id?: number; input?: AccountInput; account?: Account }) {
  switch (kind) {
    case 'CREATE_ACCOUNT': {
      if (payload.id == null || !payload.input) return;
      db.prepare(`INSERT INTO accounts (id, name, type, balance_cents, notes) VALUES (?, ?, ?, ?, ?)`)
        .run(payload.id, payload.input.name, payload.input.type, payload.input.balance_cents, payload.input.notes);
      return;
    }
    case 'UPDATE_ACCOUNT': {
      if (payload.id == null || !payload.input) return;
      db.prepare(`UPDATE accounts SET name = ?, type = ?, balance_cents = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(payload.input.name, payload.input.type, payload.input.balance_cents, payload.input.notes, payload.id);
      return;
    }
    case 'DELETE_ACCOUNT': {
      if (payload.id == null) return;
      db.prepare(`DELETE FROM accounts WHERE id = ?`).run(payload.id);
      return;
    }
  }
}

export function applyAccountReverse(kind: string, payload: { id?: number; input?: AccountInput; account?: Account }) {
  switch (kind) {
    case 'CREATE_ACCOUNT': {
      if (payload.id == null) return;
      db.prepare(`DELETE FROM accounts WHERE id = ?`).run(payload.id);
      return;
    }
    case 'UPDATE_ACCOUNT': {
      if (payload.id == null || !payload.input) return;
      db.prepare(`UPDATE accounts SET name = ?, type = ?, balance_cents = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(payload.input.name, payload.input.type, payload.input.balance_cents, payload.input.notes, payload.id);
      return;
    }
    case 'DELETE_ACCOUNT': {
      if (!payload.account) return;
      const a = payload.account;
      db.prepare(`INSERT INTO accounts (id, name, type, balance_cents, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(a.id, a.name, a.type, a.balance_cents, a.notes, a.updated_at);
      return;
    }
  }
}

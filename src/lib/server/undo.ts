import { db, transaction } from './db.js';
import { peekRedo, peekUndo, markUndone, markRedone } from './actions.js';
import { applyActivityForward, applyActivityReverse } from './activities.js';
import { applyEntryForward, applyEntryReverse } from './entries.js';
import { applyAccountForward, applyAccountReverse } from './accounts.js';
import { applyTxnForward, applyTxnReverse } from './transactions.js';
import { applyEventForward, applyEventReverse } from './calendar.js';

function applyReverse(kind: string, payload: Record<string, unknown>) {
  if (kind.endsWith('_ACTIVITY')) applyActivityReverse(kind, payload);
  else if (kind.endsWith('_ENTRY'))  applyEntryReverse(kind, payload);
  else if (kind.endsWith('_ACCOUNT')) applyAccountReverse(kind, payload);
  else if (kind === 'IMPORT_TXNS' || kind === 'DELETE_TXN') applyTxnReverse(kind, payload);
  else if (kind.endsWith('_EVENT')) applyEventReverse(kind, payload);
}

function applyForward(kind: string, payload: Record<string, unknown>) {
  if (kind.endsWith('_ACTIVITY')) applyActivityForward(kind, payload);
  else if (kind.endsWith('_ENTRY'))  applyEntryForward(kind, payload);
  else if (kind.endsWith('_ACCOUNT')) applyAccountForward(kind, payload);
  else if (kind === 'IMPORT_TXNS' || kind === 'DELETE_TXN') applyTxnForward(kind, payload);
  else if (kind.endsWith('_EVENT')) applyEventForward(kind, payload);
}

export function undo(): { undone: boolean; summary?: string } {
  const action = peekUndo();
  if (!action) return { undone: false };
  const reverse = JSON.parse(action.reverse_json) as Record<string, unknown>;
  transaction(() => {
    applyReverse(action.kind, reverse);
    markUndone(action.id);
  })();
  return { undone: true, summary: action.summary };
}

export function redo(): { redone: boolean; summary?: string } {
  const action = peekRedo();
  if (!action) return { redone: false };
  const forward = JSON.parse(action.forward_json) as Record<string, unknown>;
  transaction(() => {
    applyForward(action.kind, forward);
    markRedone(action.id);
  })();
  return { redone: true, summary: action.summary };
}

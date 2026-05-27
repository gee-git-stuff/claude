export type ActivityType = 'AIRBNB' | 'TURO' | 'PROPERTY' | 'CUSTOM';

export interface Activity {
  id: number;
  name: string;
  type: ActivityType;
  color: string;
  notes: string;
  created_at: string;
}

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL';

export interface Recurrence {
  id: number;
  frequency: RecurrenceFrequency;
  interval: number;
  end_date: string | null;
}

export type EntryKind = 'EXPENSE' | 'INCOME';

export interface Entry {
  id: number;
  activity_id: number;
  kind: EntryKind;
  amount_cents: number;
  date: string;
  category: string;
  note: string;
  recurrence_id: number | null;
  created_at: string;
}

export interface EntryWithRecurrence extends Entry {
  recurrence: Recurrence | null;
}

export type AccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'LOAN' | 'CASH' | 'OTHER';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  balance_cents: number;
  notes: string;
  updated_at: string;
}

export type ActionKind =
  | 'CREATE_ACTIVITY' | 'UPDATE_ACTIVITY' | 'DELETE_ACTIVITY'
  | 'CREATE_ENTRY'    | 'UPDATE_ENTRY'    | 'DELETE_ENTRY'
  | 'CREATE_ACCOUNT'  | 'UPDATE_ACCOUNT'  | 'DELETE_ACCOUNT';

export interface ActionRecord {
  id: number;
  kind: ActionKind;
  summary: string;
  forward_json: string;
  reverse_json: string;
  undone: 0 | 1;
  created_at: string;
}

export interface ActivityTotals {
  activity_id: number;
  expense_cents: number;
  income_cents: number;
  net_cents: number;
}

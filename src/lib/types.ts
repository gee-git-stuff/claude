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

export interface CsvMapping {
  delimiter: ',' | ';' | '\t' | '|';
  date_col: number;
  amount_col: number;
  description_col: number;
  skip_rows: number;
  date_format: 'AUTO' | 'YMD' | 'MDY' | 'DMY';
  invert_sign: boolean;
}

export const DEFAULT_CSV_MAPPING: CsvMapping = {
  delimiter: ',',
  date_col: 0,
  amount_col: 2,
  description_col: 1,
  skip_rows: 1,
  date_format: 'AUTO',
  invert_sign: false
};

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  balance_cents: number;
  notes: string;
  csv_mapping_json: string;
  updated_at: string;
}

export interface BankTransaction {
  id: number;
  account_id: number;
  date: string;
  amount_cents: number;
  description: string;
  raw_row: string;
  entry_id: number | null;
  created_at: string;
}

export type CalendarEventKind = 'BOOKING' | 'MAINTENANCE' | 'REMINDER' | 'OTHER';

export interface CalendarEvent {
  id: number;
  activity_id: number;
  title: string;
  kind: CalendarEventKind;
  start_date: string;
  end_date: string | null;
  notes: string;
  created_at: string;
}

export type ActionKind =
  | 'CREATE_ACTIVITY' | 'UPDATE_ACTIVITY' | 'DELETE_ACTIVITY'
  | 'CREATE_ENTRY'    | 'UPDATE_ENTRY'    | 'DELETE_ENTRY'
  | 'CREATE_ACCOUNT'  | 'UPDATE_ACCOUNT'  | 'DELETE_ACCOUNT'
  | 'IMPORT_TXNS'     | 'DELETE_TXN'      | 'LINK_TXN'
  | 'CREATE_EVENT'    | 'UPDATE_EVENT'    | 'DELETE_EVENT';

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

export interface MonthlyRow {
  month: string;
  activity_id: number;
  income_cents: number;
  expense_cents: number;
}

export interface CategoryRow {
  activity_id: number;
  category: string;
  kind: 'EXPENSE' | 'INCOME';
  amount_cents: number;
}

export interface ChartsResponse {
  months: number;
  labels: string[];
  monthly: MonthlyRow[];
  categories: CategoryRow[];
}

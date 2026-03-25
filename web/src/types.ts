export interface Transaction {
  id: string;
  date: string;
  desc: string;
  a: number;
  c: string;
  t: 'Expense' | 'Income' | 'Transfer' | 'Savings';
  m: string;
  notes: string;
  _k?: number;
}

export interface MonthRef { month: string; year: string }
export interface Budget { [category: string]: number }
export interface OpeningBal { [account: string]: number }

export interface AppState {
  month: string;
  year: string;
  rows: Transaction[];
  budget: Budget;
  openingBal: OpeningBal;
  months: MonthRef[];
  loading: boolean;
  txnPage: number;
  filter: string;
  catFilter: string;
}

export interface TransactionForm {
  date: string;
  desc: string;
  a: string;
  c: string;
  t: string;
  m: string;
  notes: string;
  toAcct?: string;
}

import { Budget, MonthRef, OpeningBal, Transaction } from './types';
import { API_URL } from './constants';

type ApiResponse<T> = { ok: true; data: T; traceId?: string; debug?: Record<string, unknown> } | { ok: false; error: string; traceId?: string };

// Dev: Vite proxy (/gas-proxy), Prod: Cloudflare Worker (via VITE_API_URL)
const BASE = API_URL;
const TOKEN = import.meta.env.VITE_API_TOKEN as string | undefined;
const DEBUG = import.meta.env.VITE_DEBUG === 'true';

function generateTraceId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (text.trim().startsWith('<')) {
    const isLoginPage = text.includes('accounts.google.com');
    throw new Error(isLoginPage
      ? 'GAS access restricted — go to script.google.com → Deploy → Manage deployments → set "Who has access" to Anyone'
      : 'GAS not deployed — run ./deploy.sh');
  }
  const json: ApiResponse<T> = JSON.parse(text);
  if (!json.ok) {
    const err = new Error(json.error) as Error & { traceId?: string };
    err.traceId = json.traceId;
    throw err;
  }
  if (DEBUG) {
    const msg: any = { traceId: json.traceId };
    if (json.debug) msg.debug = json.debug;
    console.log('[API Trace]', msg);
  }
  return json.data;
}

async function get<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(BASE, window.location.origin);
  const traceId = generateTraceId();
  url.searchParams.set('action', action);
  url.searchParams.set('traceId', traceId);
  if (DEBUG) url.searchParams.set('debug', 'true');
  if (TOKEN) url.searchParams.set('token', TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { redirect: 'follow' });
  return parseResponse<T>(res);
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const traceId = generateTraceId();
  const payload = {
    ...body,
    traceId,
    ...(DEBUG && { debug: true }),
    ...(TOKEN && { token: TOKEN })
  };
  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });
  return parseResponse<T>(res);
}

export interface InitData {
  months: MonthRef[];
  budget: Budget;
  openingBal: OpeningBal;
}

export interface RawLendingRow {
  id: string;
  date: string;
  name: string;
  amount: number | string;
  type: string;
  description: string;
}

export interface RawSavingsRow {
  id: string;
  date: string;
  account: string;
  amount: number | string;
  desc: string;
  type: string;
  toAccount?: string;
}

export interface RawGoldRow {
  id: string;
  name: string;
  weight_g: number | string;
  pavan: number | string;
  person: string;
  location: string;
}

export interface RawGoldHistoryRow {
  id: string;
  date: string;
  type: 'IN' | 'OUT';
  name: string;
  weight_g: number | string;
  note?: string;
}

export interface RawEmiRow {
  id: string;
  name: string;
  bank: string;
  principal: number | string;
  rate: number | string;
  start_date: string;
  tenure_months: number | string;
  emi_amount: number | string;
  paid_emis: number | string;
  status: string;
}

export interface RawJewelLoanRow {
  id: string;
  name: string;
  bank: string;
  principal: number | string;
  rate: number | string;
  start_date: string;
  end_date: string;
  paid_amount: number | string;
  status: string;
}

export interface RawJewelLoanHistoryRow {
  id: string;
  loan_id: string;
  date: string;
  amount: number | string;
  note?: string;
}

export interface RawCashLoanRow {
  id: string;
  person_name: string;
  amount_received: number | string;
  start_date: string;
  paid_amount: number | string;
}

export interface RawCashLoanHistoryRow {
  id: string;
  loan_id: string;
  date: string;
  amount: number | string;
  note?: string;
}

export interface GoldSettings {
  goldRate: number;
  loansSpreadsheetId?: string;
  emiSheetName?: string;
  expensesSheetId?: string;
  assetsSheetId?: string;
}

export interface RawHolding {
  symbol: string;
  company: string;
  isin: string;
  qty: number;
  avgPrice: number;
  lastPrice: number;
  pnl: number;
  dayChangePct: number;
  synced: string;
}

export const api = {
  init:          ()                              => get<InitData>('init'),
  getData:       (month: string, year: string)  => get<Transaction[]>('getData', { month, year }),
  addRow:        (p: Record<string, unknown>)   => post<string>({ action: 'addRow', ...p }),
  updateRow:     (p: Record<string, unknown>)   => post<boolean>({ action: 'updateRow', ...p }),
  deleteRow:     (month: string, year: string, id: string) => post<boolean>({ action: 'deleteRow', month, year, id }),
  saveBudget:        (budgets: Budget)              => post<boolean>({ action: 'saveBudget', budgets }),
  updateBudgetEntry: (cat: string, amt: number)    => post<boolean>({ action: 'updateBudgetEntry', cat, amt }),
  deleteBudgetEntry: (cat: string)                 => post<boolean>({ action: 'deleteBudgetEntry', cat }),
  saveOpeningBal:(data: OpeningBal)             => post<boolean>({ action: 'saveOpeningBal', data }),
  getLending:    (sheetName?: string)          => get<RawLendingRow[]>('getEntries', { module: 'lending', ...(sheetName && sheetName !== 'Lending' && { sheetName }) }),
  addLending:    (p: Record<string, unknown>, sheetName?: string)  => post<string>({ module: 'lending', action: 'addEntry', ...(sheetName && sheetName !== 'Lending' && { sheetName }), ...p }),
  updateLending: (p: Record<string, unknown>, sheetName?: string)  => post<boolean>({ module: 'lending', action: 'updateEntry', ...(sheetName && sheetName !== 'Lending' && { sheetName }), ...p }),
  deleteLending: (id: string, sheetName?: string)                  => post<boolean>({ module: 'lending', action: 'deleteEntry', id, ...(sheetName && sheetName !== 'Lending' && { sheetName }) }),
  getSavings:    ()                            => get<RawSavingsRow[]>('getEntries', { module: 'savings' }),
  addSavings:    (p: Record<string, unknown>)  => post<string>({ module: 'savings', action: 'addEntry', ...p }),
  updateSavings: (p: Record<string, unknown>)  => post<boolean>({ module: 'savings', action: 'updateEntry', ...p }),
  deleteSavings: (id: string)                  => post<boolean>({ module: 'savings', action: 'deleteEntry', id }),
  getGold:       ()                            => get<RawGoldRow[]>('getEntries', { module: 'gold' }),
  addGold:       (p: Record<string, unknown>)  => post<string>({ module: 'gold', action: 'addEntry', ...p }),
  updateGold:    (p: Record<string, unknown>)  => post<boolean>({ module: 'gold', action: 'updateEntry', ...p }),
  deleteGold:    (id: string)                  => post<boolean>({ module: 'gold', action: 'deleteEntry', id }),
  getGoldHistory:    ()                           => get<RawGoldHistoryRow[]>('getHistory', { module: 'gold' }),
  addGoldHistory:    (p: Record<string, unknown>) => post<string>({ module: 'gold', action: 'addHistory', ...p }),
  updateGoldHistory: (p: Record<string, unknown>) => post<{ success: boolean }>({ module: 'gold', action: 'updateHistory', ...p }),
  deleteGoldHistory: (id: string)                 => post<{ success: boolean }>({ module: 'gold', action: 'deleteHistory', id }),
  getEmi:    ()                            => get<RawEmiRow[]>('getEntries', { module: 'loans' }),
  addEmi:    (p: Record<string, unknown>) => post<string>({ module: 'loans', action: 'addEntry', ...p }),
  updateEmi: (p: Record<string, unknown>) => post<boolean>({ module: 'loans', action: 'updateEntry', ...p }),
  deleteEmi: (id: string)                 => post<boolean>({ module: 'loans', action: 'deleteEntry', id }),
  getJewelLoans:         ()                            => get<RawJewelLoanRow[]>('getEntries', { module: 'loans', type: 'jewel' }),
  addJewelLoan:          (p: Record<string, unknown>) => post<string>({ module: 'loans', action: 'addEntry', type: 'jewel', ...p }),
  updateJewelLoan:       (p: Record<string, unknown>) => post<boolean>({ module: 'loans', action: 'updateEntry', type: 'jewel', ...p }),
  deleteJewelLoan:       (id: string)                 => post<boolean>({ module: 'loans', action: 'deleteEntry', type: 'jewel', id }),
  getJewelLoanHistory:    ()                           => get<RawJewelLoanHistoryRow[]>('getHistory', { module: 'loans', type: 'jewel' }),
  addJewelLoanHistory:    (p: Record<string, unknown>) => post<string>({ module: 'loans', action: 'addHistory', type: 'jewel', ...p }),
  updateJewelLoanHistory: (p: Record<string, unknown>) => post<boolean>({ module: 'loans', action: 'updateHistory', type: 'jewel', ...p }),
  deleteJewelLoanHistory: (id: string)                 => post<boolean>({ module: 'loans', action: 'deleteHistory', type: 'jewel', id }),
  getCashLoans:          ()                            => get<RawCashLoanRow[]>('getEntries', { module: 'loans', type: 'cash' }),
  addCashLoan:           (p: Record<string, unknown>) => post<string>({ module: 'loans', action: 'addEntry', type: 'cash', ...p }),
  updateCashLoan:        (p: Record<string, unknown>) => post<boolean>({ module: 'loans', action: 'updateEntry', type: 'cash', ...p }),
  deleteCashLoan:        (id: string)                 => post<boolean>({ module: 'loans', action: 'deleteEntry', type: 'cash', id }),
  getCashLoanHistory:    ()                           => get<RawCashLoanHistoryRow[]>('getHistory', { module: 'loans', type: 'cash' }),
  addCashLoanHistory:    (p: Record<string, unknown>) => post<string>({ module: 'loans', action: 'addHistory', type: 'cash', ...p }),
  deleteCashLoanHistory: (id: string)                 => post<boolean>({ module: 'loans', action: 'deleteHistory', type: 'cash', id }),
  getSettings:   ()                            => get<GoldSettings>('get', { module: 'settings' }),
  saveSettings:  (p: Record<string, unknown>) => post<boolean>({ module: 'settings', action: 'save', ...p }),
  getTokenStatus: ()                           => get<{ hasToken: boolean }>('getTokenStatus', { module: 'stocks' }),
  getUpstoxAuthUrl: ()                         => get<{ authUrl: string }>('getAuthUrl', { module: 'stocks' }),
  setUpstoxToken: (token: string)              => post<boolean>({ module: 'stocks', action: 'setToken', token }),
  getStocks:      ()                           => get<RawHolding[]>('getHoldings', { module: 'stocks' }),
  syncStocks:     ()                           => post<{ count: number }>({ module: 'stocks', action: 'sync' }),
  getMutualFunds: ()                           => get<RawHolding[]>('getHoldings', { module: 'mutualfunds' }),
  syncMutualFunds: ()                          => post<{ count: number }>({ module: 'mutualfunds', action: 'sync' }),
  configure:     (expensesSheetId: string, assetsSheetId?: string) => post<boolean>({ action: 'configure', expensesSheetId, assetsSheetId }),
  ensureMonth:   (month: string, year: string)  => post<boolean>({ action: 'ensureMonth', month, year }),
  resetBudget:   ()                             => post<Budget>({ action: 'resetBudget' }),
  gemini:        (system: string, prompt: string, forceTool?: boolean) => post<string>({ action: 'gemini', system, prompt, forceTool }),
};

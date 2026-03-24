import { Budget, MonthRef, OpeningBal, Transaction } from './types';
import { GAS_URL } from './constants';

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

// In dev, use Vite proxy to avoid CORS; in prod use GAS URL directly
const BASE = import.meta.env.DEV ? '/gas-proxy' : GAS_URL;
const TOKEN = import.meta.env.VITE_API_TOKEN as string | undefined;

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (text.trim().startsWith('<')) {
    const isLoginPage = text.includes('accounts.google.com');
    throw new Error(isLoginPage
      ? 'GAS access restricted — go to script.google.com → Deploy → Manage deployments → set "Who has access" to Anyone'
      : 'GAS not deployed — run ./deploy.sh');
  }
  const json: ApiResponse<T> = JSON.parse(text);
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

async function get<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(BASE, window.location.origin);
  url.searchParams.set('action', action);
  if (TOKEN) url.searchParams.set('token', TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { redirect: 'follow' });
  return parseResponse<T>(res);
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(BASE, {
    method: 'POST',
    body: JSON.stringify(TOKEN ? { ...body, token: TOKEN } : body),
    redirect: 'follow',
  });
  return parseResponse<T>(res);
}

export interface InitData {
  months: MonthRef[];
  budget: Budget;
  openingBal: OpeningBal;
}

export const api = {
  init:          ()                              => get<InitData>('init'),
  getData:       (month: string, year: string)  => get<Transaction[]>('getData', { month, year }),
  addRow:        (p: Record<string, unknown>)   => post<string>({ action: 'addRow', ...p }),
  updateRow:     (p: Record<string, unknown>)   => post<boolean>({ action: 'updateRow', ...p }),
  deleteRow:     (month: string, year: string, id: string) => post<boolean>({ action: 'deleteRow', month, year, id }),
  saveBudget:    (budgets: Budget)              => post<boolean>({ action: 'saveBudget', budgets }),
  saveOpeningBal:(data: OpeningBal)             => post<boolean>({ action: 'saveOpeningBal', data }),
  configure:     (sheetId: string)              => post<boolean>({ action: 'configure', sheetId }),
  ensureMonth:   (month: string, year: string)  => post<boolean>({ action: 'ensureMonth', month, year }),
  resetBudget:   ()                             => post<Budget>({ action: 'resetBudget' }),
  gemini:        (system: string, prompt: string, forceTool?: boolean) => post<string>({ action: 'gemini', system, prompt, forceTool }),
};

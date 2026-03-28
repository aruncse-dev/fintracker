import React, { createContext, useContext, useReducer } from 'react';
import { AppState, Transaction, Budget, OpeningBal, MonthRef } from './types';
import { dateKey, currentMonthYear } from './utils';
import { TXN_PAGE } from './constants';

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_MONTH'; payload: { month: string; year: string } }
  | { type: 'SET_ROWS'; payload: Transaction[] }
  | { type: 'SET_MONTHS'; payload: MonthRef[] }
  | { type: 'SET_BUDGET'; payload: Budget }
  | { type: 'SET_OPENING_BAL'; payload: OpeningBal }
  | { type: 'SET_FILTER'; payload: string }
  | { type: 'SET_CAT_FILTER'; payload: string }
  | { type: 'SET_TXN_PAGE'; payload: number }
  | { type: 'SET_SEARCH'; payload: string };

const { month, year } = currentMonthYear();

const initial: AppState = {
  month, year, rows: [], budget: {}, openingBal: {},
  months: [], loading: true, txnPage: 1, filter: 'All', catFilter: '', search: '',
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_LOADING':     return { ...state, loading: action.payload };
    case 'SET_MONTH':       return { ...state, ...action.payload, txnPage: 1, filter: 'All', catFilter: '', search: '' };
    case 'SET_ROWS':        return { ...state, rows: action.payload.map(r => ({ ...r, _k: dateKey(r.date) })).sort((a,b) => (b._k||0)-(a._k||0)) };
    case 'SET_MONTHS':      return { ...state, months: action.payload };
    case 'SET_BUDGET':      return { ...state, budget: action.payload };
    case 'SET_OPENING_BAL': return { ...state, openingBal: action.payload };
    case 'SET_FILTER':      return { ...state, filter: action.payload, catFilter: '', txnPage: 1 };
    case 'SET_CAT_FILTER':  return { ...state, catFilter: action.payload, filter: 'All', txnPage: 1 };
    case 'SET_TXN_PAGE':    return { ...state, txnPage: action.payload };
    case 'SET_SEARCH':      return { ...state, search: action.payload, txnPage: 1 };
    default:                return state;
  }
}

const Ctx = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}

export function usePage() {
  const { state } = useStore();
  const { rows, filter, catFilter, search } = state;
  let all = filter === 'All' ? rows : rows.filter(r => r.m === filter || r.t === filter);
  if (catFilter) all = all.filter(r => r.c === catFilter);
  if (search) {
    const q = search.toLowerCase();
    all = all.filter(r => r.desc.toLowerCase().includes(q) || r.c.toLowerCase().includes(q) || r.m.toLowerCase().includes(q) || r.notes.toLowerCase().includes(q));
  }
  const total = all.length;
  const shown = Math.min(state.txnPage * TXN_PAGE, total);
  return { rows: all.slice(0, shown), total, shown };
}

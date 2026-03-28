import { Transaction, Budget, OpeningBal } from './types';
import { ACCOUNTS, CC_MODES, OTHER_CR, ALL_CR, MNS } from './constants';

/**
 * Format number as Indian Rupee with Indian numbering system
 * Examples: 1234 → ₹1,234 | 123456 → ₹1,23,456
 * Handles decimals: show only if significant (not .00)
 */
export function INR(n: number): string {
  const abs = Math.abs(n);
  const hasDecimals = abs % 1 !== 0;

  if (hasDecimals) {
    // Show decimals only if significant
    const formatted = abs.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return '₹' + formatted;
  }

  // No decimals
  return '₹' + Math.round(abs).toLocaleString('en-IN');
}

export function fd(s: string): string {
  if (!s) return '—';
  const m = s.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3})/);
  return m ? parseInt(m[1]) + ' ' + m[2] : s;
}

export function isoDate(s: string): string {
  if (!s) return '';
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) return '';
  const mo = MNS.indexOf(m[2] as typeof MNS[number]);
  if (mo < 0) return '';
  return `20${m[3]}-${String(mo + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

export function dateKey(s: string): number {
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) return 0;
  const mo = MNS.indexOf(m[2] as typeof MNS[number]);
  return parseInt('20' + m[3]) * 10000 + (mo + 1) * 100 + parseInt(m[1]);
}

// Each expense counts under its own category key.
// Do NOT remap unknown categories to 'Others' — that inflates Others when
// a budget category is deleted or the AI assigns a category not in the budget,
// causing false overspend on the Others row.
export function catMap(rows: Transaction[], _budget?: Budget): Record<string, number> {
  const cm: Record<string, number> = {};
  rows.filter(r => r.t === 'Expense').forEach(r => {
    cm[r.c] = (cm[r.c] || 0) + r.a;
  });
  return cm;
}

export function sumType(rows: Transaction[], type: string): number {
  return rows.filter(r => r.t === type).reduce((s, r) => s + r.a, 0);
}

export function sumCC(rows: Transaction[]): number {
  return rows.filter(r => (CC_MODES as readonly string[]).includes(r.m)).reduce((s, r) => s + r.a, 0);
}

export function sumOtherCr(rows: Transaction[]): number {
  return rows.filter(r => (OTHER_CR as readonly string[]).includes(r.m)).reduce((s, r) => s + r.a, 0);
}

export function budgetSummary(budget: Budget, cm: Record<string, number>) {
  const active = Object.entries(budget).filter(([, b]) => b > 0);
  const totalBudget = active.reduce((s, [, b]) => s + b, 0);
  const totalSpent  = active.reduce((s, [c]) => s + (cm[c] || 0), 0);
  const ovCount     = active.filter(([c, b]) => (cm[c] || 0) > b).length;
  const totalOver   = totalSpent > totalBudget;
  const totalPct    = totalBudget ? Math.min(totalSpent / totalBudget * 100, 100) : 0;
  const tCol        = totalOver ? 'var(--rm)' : 'var(--gm)';
  return { totalBudget, totalSpent, ovCount, totalOver, totalPct, tCol };
}

export function acctFlows(rows: Transaction[], openingBal: OpeningBal) {
  const result: Record<string, { inflow: number; outflow: number; current: number }> = {};
  ACCOUNTS.forEach(acc => {
    let inflow = 0, outflow = 0;
    rows.forEach(r => {
      if (r.m === acc) {
        if (r.t === 'Income') inflow += r.a;
        else if (r.t === 'Expense') outflow += r.a;
        else if (r.t === 'Transfer') outflow += r.a;
      }
      if (r.t === 'Transfer' && r.notes?.startsWith('→' + acc)) inflow += r.a;
    });
    const opening = openingBal[acc] || 0;
    result[acc] = { inflow, outflow, current: opening + inflow - outflow };
  });
  return result;
}

export function catIcon(cat: string): string {
  const icons: Record<string, string> = {
    'Long Term Loan':'🏠','Jewel Loan':'💍','Insurance':'🛡️','SIP/Savings':'📈',
    'Emergency Fund':'🚨','Rent':'🏘️','Vijaya Amma':'👵','Staff Salary':'👷',
    'Groceries':'🛒','Rice':'🍚','Milk':'🥛','Vegetables':'🥦','Fruits':'🍎',
    'Food/Eating Out':'🍽️','Snacks':'🍿','Meat':'🥩','Education':'🎓','Kids':'👶',
    'Health & Medical':'💊','Amma':'🙏','Body Care':'🧴','Dress':'👗',
    'Entertainment':'🎬','Travel':'✈️','Gifts/Functions':'🎁','Home Care':'🏡',
    'Maintenance':'🔧','Internet/Recharge':'📱','Electricity':'⚡','Cylinder':'🔥',
    'Car':'🚗','Daily Expenses':'💰','NGO':'❤️','Others':'📦',
    'Salary':'💵','Cashback':'💳','Other Income':'💸',
    'Cash':'💵','HDFC Bank':'🏦','Wallet':'👛',
    'ICICI':'💳','HDFC':'💳','Bommi':'🤝','Ramya':'🤝',
  };
  return icons[cat] || '📌';
}

export function isAccountMode(m: string): m is typeof ACCOUNTS[number] {
  return (ACCOUNTS as readonly string[]).includes(m);
}

export function isCrMode(m: string): boolean {
  return (ALL_CR as readonly string[]).includes(m);
}

export function currentMonthYear(): { month: string; year: string } {
  const now = new Date();
  // CC billing cycle starts on the 19th — once we pass day 19 we're in the next month's cycle
  const cycleDay = 19;
  let mi = now.getMonth();
  let yr = now.getFullYear();
  if (now.getDate() >= cycleDay) {
    mi = (mi + 1) % 12;
    if (mi === 0) yr++;
  }
  return { month: MNS[mi], year: String(yr) };
}

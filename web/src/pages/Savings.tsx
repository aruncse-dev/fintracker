import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Plus, X, Check, Trash2, AlertTriangle, Loader2, Search, LayoutDashboard, List, Pencil } from 'lucide-react';
import { api, RawSavingsRow } from '../api';
import { INR } from '../utils';

// ──────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

type SavingsAccount = 'Amma IB' | 'Ramya IB' | 'Arun IB' | 'Amma SBI' | 'Cash';
type SavingsType = 'Income' | 'Expense' | 'Transfer';
type SavingsTab = 'dashboard' | 'transactions';

interface SavingsEntry {
  id: string;
  date: string; // ISO "YYYY-MM-DD"
  account: SavingsAccount;
  amount: number;
  desc: string;
  type: SavingsType;
  toAccount?: SavingsAccount;
}

interface SavingsFormState {
  date: string;
  account: SavingsAccount;
  amount: string;
  desc: string;
  type: SavingsType;
  toAccount: SavingsAccount;
}

const ACCOUNTS: SavingsAccount[] = ['Amma IB', 'Ramya IB', 'Arun IB', 'Amma SBI', 'Cash'];

const ACCOUNT_COLORS: Record<SavingsAccount, string> = {
  'Amma IB': '#3B82F6',
  'Ramya IB': '#8B5CF6',
  'Arun IB': '#10B981',
  'Amma SBI': '#F59E0B',
  'Cash': '#6B7280',
};

const TYPE_FILTERS = ['All', 'Income', 'Expense', 'Transfer'] as const;

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function toDateInput(dateStr: string): string {
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch {
    return todayISO();
  }
}

function emptyForm(): SavingsFormState {
  return {
    date: todayISO(),
    account: 'Arun IB',
    amount: '',
    desc: '',
    type: 'Income',
    toAccount: 'Amma IB',
  };
}

function parseRow(raw: RawSavingsRow): SavingsEntry | null {
  const type = String(raw.type ?? '').trim().toUpperCase();
  if (type !== 'INCOME' && type !== 'EXPENSE' && type !== 'TRANSFER') return null;
  const amount = parseFloat(String(raw.amount));
  if (isNaN(amount) || amount <= 0) return null;
  const account = String(raw.account ?? '').trim() as SavingsAccount;
  if (!ACCOUNTS.includes(account)) return null;
  const entry: SavingsEntry = {
    id: raw.id,
    date: String(raw.date ?? '').trim(),
    account,
    amount,
    desc: String(raw.desc ?? '').trim(),
    type: (type === 'INCOME' ? 'Income' : type === 'EXPENSE' ? 'Expense' : 'Transfer') as SavingsType,
  };
  if (type === 'TRANSFER') {
    const to = String(raw.toAccount ?? '').trim() as SavingsAccount;
    if (ACCOUNTS.includes(to)) entry.toAccount = to;
  }
  return entry;
}

function computeBalances(entries: SavingsEntry[]): Record<SavingsAccount, number> {
  const balances = Object.fromEntries(ACCOUNTS.map(a => [a, 0])) as Record<SavingsAccount, number>;
  for (const e of entries) {
    if (e.type === 'Income') balances[e.account] += e.amount;
    if (e.type === 'Expense') balances[e.account] -= e.amount;
    if (e.type === 'Transfer') {
      balances[e.account] -= e.amount;
      if (e.toAccount) balances[e.toAccount] += e.amount;
    }
  }
  return balances;
}

// ──────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ──────────────────────────────────────────────────────────────────────────────

const AccountBalanceCard = memo(function AccountBalanceCard({
  name,
  balance,
}: {
  name: SavingsAccount;
  balance: number;
}) {
  const balanceColor = balance > 0 ? '#10B981' : balance < 0 ? '#EF4444' : 'var(--text)';
  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>{name}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: balanceColor }}>{INR(balance)}</div>
    </div>
  );
});

function TypeBadge({ type }: { type: SavingsType }) {
  const bgColor = type === 'Income' ? '#10B981' : type === 'Expense' ? '#EF4444' : '#3B82F6';
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      background: bgColor,
      color: '#fff',
      padding: '4px 8px',
      borderRadius: 4,
      whiteSpace: 'nowrap',
    }}>
      {type}
    </span>
  );
}

function typeColor(type: SavingsType): string {
  if (type === 'Income') return '#10B981';
  if (type === 'Expense') return '#EF4444';
  return '#3B82F6'; // Transfer
}

const DonutChart = memo(function DonutChart({ balances }: { balances: Record<SavingsAccount, number> }) {
  const positiveBalances = ACCOUNTS.map(a => ({ account: a, balance: Math.max(0, balances[a]) }));
  const total = positiveBalances.reduce((s, x) => s + x.balance, 0);

  const segments = total === 0
    ? ACCOUNTS.map(a => ({ account: a, pct: 1 / ACCOUNTS.length }))
    : positiveBalances.map(x => ({ account: x.account, pct: x.balance / total }));

  const CX = 90, CY = 90, OR = 80, IR = 50;

  function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArc(cx: number, cy: number, outerR: number, innerR: number, startDeg: number, endDeg: number): string {
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    const o1 = polarToXY(cx, cy, outerR, startDeg);
    const o2 = polarToXY(cx, cy, outerR, endDeg);
    const i1 = polarToXY(cx, cy, innerR, endDeg);
    const i2 = polarToXY(cx, cy, innerR, startDeg);
    return [
      `M ${o1.x} ${o1.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${o2.x} ${o2.y}`,
      `L ${i1.x} ${i1.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${i2.x} ${i2.y}`,
      'Z'
    ].join(' ');
  }

  let cursor = 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <svg viewBox="0 0 180 180" width={180} height={180}>
        {segments.map(({ account, pct }) => {
          const startDeg = cursor * 360;
          cursor += pct;
          const endDeg = cursor * 360;

          if (pct >= 0.9999) {
            // Full circle: use <circle> elements instead of arc
            return (
              <g key={account}>
                <circle cx={CX} cy={CY} r={OR} fill={total === 0 ? '#E5E7EB' : ACCOUNT_COLORS[account]} opacity={total === 0 ? 0.4 : 1} />
                <circle cx={CX} cy={CY} r={IR} fill="var(--bg)" />
              </g>
            );
          }

          const path = describeArc(CX, CY, OR, IR, startDeg, endDeg - 0.3);
          return (
            <path
              key={account}
              d={path}
              fill={total === 0 ? '#E5E7EB' : ACCOUNT_COLORS[account]}
              opacity={total === 0 ? 0.4 : 1}
            />
          );
        })}
        {/* Centre label */}
        <text x={CX} y={CY - 5} textAnchor="middle" fontSize={10} fill="var(--muted)" fontWeight={600}>
          TOTAL
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize={13} fill="var(--text)" fontWeight={700}>
          {INR(Math.max(0, total))}
        </text>
      </svg>

      {/* Legend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', width: '100%' }}>
        {ACCOUNTS.map(a => (
          <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: ACCOUNT_COLORS[a], flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1 }}>{a}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{INR(balances[a])}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────────────

export default function Savings() {
  // Data
  const [entries, setEntries] = useState<SavingsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tab / filter
  const [activeTab, setActiveTab] = useState<SavingsTab>('dashboard');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [search, setSearch] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<SavingsEntry | null>(null);
  const [form, setForm] = useState<SavingsFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  // Derivations
  const balances = useMemo(() => computeBalances(entries), [entries]);
  const totalBalance = useMemo(() => ACCOUNTS.reduce((s, a) => s + balances[a], 0), [balances]);
  const totalIncome = useMemo(() => entries.filter(e => e.type === 'Income').reduce((s, e) => s + e.amount, 0), [entries]);
  const totalExpenses = useMemo(() => entries.filter(e => e.type === 'Expense').reduce((s, e) => s + e.amount, 0), [entries]);

  const filteredEntries = useMemo(() => {
    return entries
      .filter(e => typeFilter === 'All' || e.type === typeFilter)
      .filter(e => {
        const q = search.toLowerCase();
        return !q || e.desc.toLowerCase().includes(q)
          || e.account.toLowerCase().includes(q)
          || e.type.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, typeFilter, search]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await api.getSavings();
      setEntries(rows.map(parseRow).filter((e): e is SavingsEntry => e !== null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  function openAdd() {
    setEditEntry(null);
    setForm(emptyForm());
    setDelConfirm(false);
    setModalOpen(true);
  }

  function openEdit(e: SavingsEntry) {
    setEditEntry(e);
    setForm({
      date: toDateInput(e.date),
      account: e.account,
      amount: String(e.amount),
      desc: e.desc,
      type: e.type,
      toAccount: e.toAccount ?? 'Amma IB',
    });
    setDelConfirm(false);
    setModalOpen(true);
  }

  function setField<K extends keyof SavingsFormState>(k: K, v: SavingsFormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.amount || parseFloat(form.amount) <= 0) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      date: form.date,
      account: form.account,
      amount: parseFloat(form.amount),
      desc: form.desc.trim(),
      type: form.type === 'Income' ? 'INCOME' : form.type === 'Expense' ? 'EXPENSE' : 'TRANSFER',
    };
    if (form.type === 'Transfer') payload.toAccount = form.toAccount;
    try {
      if (editEntry) {
        await api.updateSavings({ ...payload, id: editEntry.id });
      } else {
        await api.addSavings(payload);
      }
      setModalOpen(false);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!delConfirm) {
      setDelConfirm(true);
      return;
    }
    if (!editEntry) return;
    setSaving(true);
    try {
      await api.deleteSavings(editEntry.id);
      setModalOpen(false);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="pg" style={{ paddingBottom: 80 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        <button
          className="btn btn-sm"
          style={{
            background: activeTab === 'dashboard' ? 'var(--navy)' : 'var(--border)',
            color: activeTab === 'dashboard' ? '#fff' : 'var(--text)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            gap: 6,
          }}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={14} /> Dashboard
        </button>
        <button
          className="btn btn-sm"
          style={{
            background: activeTab === 'transactions' ? 'var(--navy)' : 'var(--border)',
            color: activeTab === 'transactions' ? '#fff' : 'var(--text)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            gap: 6,
          }}
          onClick={() => setActiveTab('transactions')}
        >
          <List size={14} /> Transactions
        </button>
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <>
          {/* KPI row */}
          <div className="kpis" style={{ marginBottom: 20 }}>
            <div className="card" style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
                Total Balance
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                {INR(totalBalance)}
              </div>
            </div>
            <div className="card" style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
                Total Income
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#10B981' }}>
                {INR(totalIncome)}
              </div>
            </div>
            <div className="card" style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
                Total Expenses
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#EF4444' }}>
                {INR(totalExpenses)}
              </div>
            </div>
          </div>

          {/* Account balance cards */}
          <div className="sec" style={{ marginBottom: 20 }}>
            <div className="sec-h" style={{ marginBottom: 12 }}>Accounts</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {ACCOUNTS.map(acc => (
                <AccountBalanceCard key={acc} name={acc} balance={balances[acc]} />
              ))}
            </div>
          </div>

          {/* Donut chart */}
          <div className="sec">
            <div className="sec-h" style={{ marginBottom: 12 }}>Balance Distribution</div>
            <div className="card" style={{ padding: 16 }}>
              <DonutChart balances={balances} />
            </div>
          </div>
        </>
      )}

      {/* TRANSACTIONS TAB */}
      {activeTab === 'transactions' && (
        <>
          {/* Search bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--card)',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            marginBottom: 16,
          }}>
            <Search size={16} style={{ color: 'var(--muted)' }} />
            <input
              type="text"
              placeholder="Search desc, account, type…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                color: 'var(--text)',
                outline: 'none',
                fontSize: 14,
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filter pills + Add button */}
          <div className="sec" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
              {TYPE_FILTERS.map(f => (
                <button
                  key={f}
                  className="btn btn-sm"
                  style={{
                    background: typeFilter === f ? 'var(--navy)' : 'var(--border)',
                    color: typeFilter === f ? '#fff' : 'var(--text)',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => setTypeFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <button className="btn btn-sm btn-green" style={{ gap: 5 }} onClick={openAdd}>
              <Plus size={14} /> Add
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '1rem 0', color: 'var(--muted)', fontSize: 14 }}>
              <Loader2 size={16} className="spin-icon" /> Loading…
            </div>
          )}

          {/* Empty state */}
          {!loading && filteredEntries.length === 0 && (
            <p style={{ color: 'var(--muted)', padding: '1rem 0', fontSize: 14 }}>No entries to display.</p>
          )}

          {/* Mobile cards */}
          {!loading && filteredEntries.length > 0 && (
            <div className="txn-cards">
              {filteredEntries.map(e => (
                <div
                  key={e.id}
                  className="txn-card"
                  style={{
                    cursor: 'pointer',
                    borderLeft: `4px solid ${typeColor(e.type)}`,
                  }}
                  onClick={() => openEdit(e)}
                >
                  <div className="txn-card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text)' }}>{e.desc || e.account}</span>
                    <span className="mono" style={{ color: typeColor(e.type), fontWeight: 700 }}>
                      {e.type === 'Income' ? '+' : '−'}{INR(e.amount)}
                    </span>
                  </div>
                  <div className="txn-card-bot" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{e.date}</span>
                    <span style={{ fontSize: 11, color: ACCOUNT_COLORS[e.account], fontWeight: 600 }}>{e.account}</span>
                    <TypeBadge type={e.type} />
                    {e.type === 'Transfer' && e.toAccount && (
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>→ {e.toAccount}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Desktop table */}
          {!loading && filteredEntries.length > 0 && (
            <div className="tw txn-table">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Account</th>
                    <th>Amount</th>
                    <th>Desc</th>
                    <th>Type</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map(e => (
                    <tr key={e.id}>
                      <td style={{ color: 'var(--muted)', fontSize: 11 }}>{e.id.slice(0, 8)}</td>
                      <td>{e.date}</td>
                      <td>
                        <span style={{ color: ACCOUNT_COLORS[e.account], fontWeight: 500 }}>{e.account}</span>
                      </td>
                      <td className="mono" style={{ color: typeColor(e.type), fontWeight: 700 }}>
                        {INR(e.amount)}
                      </td>
                      <td>{e.desc}</td>
                      <td>
                        <TypeBadge type={e.type} />
                      </td>
                      <td>
                        <button
                          className="icon-btn"
                          onClick={() => openEdit(e)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Error message */}
      {error && (
        <p style={{ color: '#EF4444', fontSize: 13, padding: '12px 10px', marginTop: 12 }}>
          ⚠ {error}
        </p>
      )}

      {/* MODAL */}
      {modalOpen && (
        <div className="modal-bg open" onClick={ev => { if (ev.target === ev.currentTarget) setModalOpen(false); }}>
          <div className="modal">
            <div className="modal-hd">
              <span className="modal-title">{editEntry ? 'Edit Transaction' : 'Add Transaction'}</span>
              <button className="modal-close" onClick={() => setModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label className="form-lbl">Date</label>
                <input
                  className="form-inp"
                  type="date"
                  value={form.date}
                  onChange={e => setField('date', e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="form-lbl">Account</label>
                <select
                  className="form-sel"
                  value={form.account}
                  onChange={e => {
                    const newAccount = e.target.value as SavingsAccount;
                    setField('account', newAccount);
                    // Auto-reset toAccount if it matches the new account
                    if (form.toAccount === newAccount) {
                      const newToAcct = ACCOUNTS.find(a => a !== newAccount);
                      if (newToAcct) setField('toAccount', newToAcct);
                    }
                  }}
                >
                  {ACCOUNTS.map(a => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label className="form-lbl">Amount (₹)</label>
                <input
                  className="form-inp mono"
                  type="number"
                  min="0"
                  step="1"
                  value={form.amount}
                  onChange={e => setField('amount', e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="form-lbl">Description</label>
                <input
                  className="form-inp"
                  type="text"
                  placeholder="Optional"
                  value={form.desc}
                  onChange={e => setField('desc', e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="form-lbl">Type</label>
                <select
                  className="form-sel"
                  value={form.type}
                  onChange={e => setField('type', e.target.value as SavingsType)}
                >
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                  <option value="Transfer">Transfer</option>
                </select>
              </div>
              {form.type === 'Transfer' && (
                <div className="form-row">
                  <label className="form-lbl">To Account</label>
                  <select
                    className="form-sel"
                    value={form.toAccount}
                    onChange={e => setField('toAccount', e.target.value as SavingsAccount)}
                  >
                    {ACCOUNTS.filter(a => a !== form.account).map(a => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <div className="modal-foot-l">
                {editEntry && (
                  <button
                    className="btn btn-red btn-sm"
                    onClick={del}
                    disabled={saving}
                  >
                    {delConfirm ? (
                      <>
                        <AlertTriangle size={14} /> Confirm?
                      </>
                    ) : (
                      <>
                        <Trash2 size={14} /> Delete
                      </>
                    )}
                  </button>
                )}
              </div>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--border)', color: 'var(--text)' }}
                onClick={() => setModalOpen(false)}
              >
                <X size={14} /> Cancel
              </button>
              <button
                className="btn btn-sm btn-green"
                onClick={save}
                disabled={saving || !form.amount || parseFloat(form.amount) <= 0}
              >
                {saving ? (
                  <Loader2 size={14} className="spin-icon" />
                ) : editEntry ? (
                  <>
                    <Check size={14} /> Save
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Add
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

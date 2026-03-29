import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Check, Trash2, Loader2, BarChart3, CreditCard, LayoutDashboard, Clock } from 'lucide-react';
import { api, RawCashLoanRow, RawCashLoanHistoryRow } from '../api';
import { INR } from '../utils';

// ──────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

interface CashLoan {
  id: string;
  person_name: string;
  amount_received: number;
  start_date: string;
  paid_amount: number;
}

interface CashLoanPayment {
  id: string;
  loan_id: string;
  date: string;
  amount: number;
  note: string;
}

interface LoanFormState {
  person_name: string;
  amount_received: string;
  start_date: string;
}

interface PaymentFormState {
  date: string;
  amount: string;
  note: string;
}

function emptyLoanForm(): LoanFormState {
  return {
    person_name: '',
    amount_received: '',
    start_date: new Date().toISOString().split('T')[0],
  };
}

function emptyPaymentForm(): PaymentFormState {
  return {
    date: new Date().toISOString().split('T')[0],
    amount: '',
    note: '',
  };
}

function parseRow(raw: RawCashLoanRow): CashLoan | null {
  const amount_received = parseFloat(String(raw.amount_received));
  const paid_amount = parseFloat(String(raw.paid_amount));

  if (isNaN(amount_received) || isNaN(paid_amount)) return null;

  return {
    id: raw.id,
    person_name: String(raw.person_name ?? '').trim(),
    amount_received,
    start_date: String(raw.start_date ?? ''),
    paid_amount,
  };
}

function parsePaymentRow(raw: RawCashLoanHistoryRow): CashLoanPayment | null {
  const amount = parseFloat(String(raw.amount));
  if (isNaN(amount)) return null;

  return {
    id: raw.id,
    loan_id: String(raw.loan_id ?? ''),
    date: String(raw.date ?? ''),
    amount,
    note: String(raw.note ?? '').trim(),
  };
}

// Parse dates in multiple formats: YYYY-MM-DD, dd-MMM-yy, or ISO format
function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);

  const cleanDate = dateStr.split('T')[0];

  // Try to parse as dd-MMM-yy format (from API, e.g., "05-Jul-22")
  const dmmyRegex = /^(\d{2})-([A-Za-z]{3})-(\d{2})$/;
  const dmmyMatch = cleanDate.match(dmmyRegex);
  if (dmmyMatch) {
    const [, day, monthStr, yearStr] = dmmyMatch;
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthIndex = months.indexOf(monthStr.toLowerCase());
    if (monthIndex !== -1) {
      const year = 2000 + parseInt(yearStr);
      return new Date(year, monthIndex, parseInt(day));
    }
  }

  // Try to parse as YYYY-MM-DD format (from form input)
  const yyyymmddRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const yyyymmddMatch = cleanDate.match(yyyymmddRegex);
  if (yyyymmddMatch) {
    const [, year, month, day] = yyyymmddMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  return new Date(NaN);
}

// Format date for display (dd-MMM-yy)
function fmtDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = parseDate(dateStr);
  if (isNaN(date.getTime())) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
  const y = String(date.getFullYear()).slice(2);
  return `${d}-${m}-${y}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────────────

export default function CashLoans() {
  // Tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard');

  // Data
  const [loans, setLoans] = useState<CashLoan[]>([]);
  const [payments, setPayments] = useState<CashLoanPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Loan Modal
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [editLoan, setEditLoan] = useState<CashLoan | null>(null);
  const [loanForm, setLoanForm] = useState<LoanFormState>(emptyLoanForm());
  const [saving, setSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  // Payment Modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payLoanId, setPayLoanId] = useState('');
  const [payForm, setPayForm] = useState<PaymentFormState>(emptyPaymentForm());
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState('');

  // Payment Delete
  const [delPaymentId, setDelPaymentId] = useState<string | null>(null);
  const [delPaymentConfirm, setDelPaymentConfirm] = useState(false);
  const [delPaymentModal, setDelPaymentModal] = useState(false);

  // Derivations
  const totalReceived = useMemo(() => {
    return loans.reduce((s, l) => s + l.amount_received, 0);
  }, [loans]);

  const totalPaid = useMemo(() => {
    return loans.reduce((s, l) => s + l.paid_amount, 0);
  }, [loans]);

  const totalOutstanding = useMemo(() => {
    return loans.reduce((s, l) => s + (l.amount_received - l.paid_amount), 0);
  }, [loans]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [loansData, paymentsData] = await Promise.all([
        api.getCashLoans(),
        api.getCashLoanHistory(),
      ]);
      setLoans(loansData.map(parseRow).filter((i): i is CashLoan => i !== null));
      setPayments(paymentsData.map(parsePaymentRow).filter((i): i is CashLoanPayment => i !== null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load loans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Loan Form handlers
  function setLoanField<K extends keyof LoanFormState>(k: K, v: LoanFormState[K]) {
    setLoanForm(f => ({ ...f, [k]: v }));
  }

  function openAddLoan() {
    setEditLoan(null);
    setLoanForm(emptyLoanForm());
    setDelConfirm(false);
    setError('');
    setLoanModalOpen(true);
  }

  function openEditLoan(loan: CashLoan) {
    setEditLoan(loan);
    const parsed = parseDate(loan.start_date);
    const formattedStartDate = !isNaN(parsed.getTime())
      ? `${String(parsed.getFullYear()).padStart(4, '0')}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
      : '';

    setLoanForm({
      person_name: loan.person_name,
      amount_received: String(loan.amount_received),
      start_date: formattedStartDate,
    });
    setDelConfirm(false);
    setError('');
    setLoanModalOpen(true);
  }

  async function saveLoan() {
    if (!loanForm.person_name.trim() || !loanForm.amount_received) return;

    setSaving(true);
    const payload = {
      person_name: loanForm.person_name.trim(),
      amount_received: parseFloat(loanForm.amount_received),
      start_date: loanForm.start_date,
    };

    try {
      if (editLoan) {
        await api.updateCashLoan({ ...payload, id: editLoan.id });
      } else {
        await api.addCashLoan(payload);
      }
      setLoanModalOpen(false);
      setEditLoan(null);
      setLoanForm(emptyLoanForm());
      setDelConfirm(false);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteLoan() {
    if (!delConfirm) {
      setDelConfirm(true);
      return;
    }
    if (!editLoan) return;

    setSaving(true);
    try {
      await api.deleteCashLoan(editLoan.id);
      setLoanModalOpen(false);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  // Payment Modal handlers
  function setPayField<K extends keyof PaymentFormState>(k: K, v: PaymentFormState[K]) {
    setPayForm(f => ({ ...f, [k]: v }));
  }

  async function savePayment() {
    if (!payForm.amount || !payLoanId) return;

    setPaySaving(true);
    const payload = {
      loan_id: payLoanId,
      date: payForm.date,
      amount: parseFloat(payForm.amount),
      note: payForm.note.trim(),
    };

    try {
      await api.addCashLoanHistory(payload);
      setPayModalOpen(false);
      setPayLoanId('');
      setPayForm(emptyPaymentForm());
      await loadData();
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Failed to add payment');
    } finally {
      setPaySaving(false);
    }
  }

  function openDeletePaymentModal(paymentId: string) {
    setDelPaymentId(paymentId);
    setDelPaymentConfirm(false);
    setDelPaymentModal(true);
  }

  async function confirmDeletePayment() {
    if (!delPaymentId) return;

    setDelPaymentConfirm(true);
    try {
      await api.deleteCashLoanHistory(delPaymentId);
      await loadData();
      setDelPaymentId(null);
      setDelPaymentConfirm(false);
      setDelPaymentModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
      setDelPaymentConfirm(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Tab bar */}
      <nav className="tab-bar">
        <button className={`tab-item${activeTab === 'dashboard' ? ' active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <span className="tab-icon"><LayoutDashboard size={19} /></span>
          <span>Dashboard</span>
        </button>
        <button className={`tab-item${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}>
          <span className="tab-icon"><Clock size={19} /></span>
          <span>History</span>
        </button>
      </nav>

      <div className="pg">

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <>
            {/* Metrics Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <BarChart3 size={20} style={{ color: 'var(--text)' }} />
              <div style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--text)' }}>Metrics</div>
            </div>

            {/* KPI Cards */}
            <div className="kpis" style={{ marginBottom: '1.5rem' }}>
              <div className="kpi">
                <div className="kpi-l">Total Received</div>
                <div className="kpi-v">{INR(totalReceived)}</div>
              </div>

              <div className="kpi">
                <div className="kpi-l">Total Paid</div>
                <div className="kpi-v" style={{ color: '#10B981' }}>{INR(totalPaid)}</div>
              </div>

              <div className="kpi">
                <div className="kpi-l">Total Outstanding</div>
                <div className="kpi-v" style={{ color: '#EF4444' }}>{INR(totalOutstanding)}</div>
              </div>
            </div>

            {/* Loans Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', marginTop: '2rem' }}>
              <CreditCard size={20} style={{ color: 'var(--text)' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Loans</div>
            </div>

            {/* Loans Section */}
            <div style={{ marginTop: 0 }}>
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2rem 0', color: 'var(--muted)', fontSize: 14 }}>
                  <Loader2 size={16} className="spin-icon" /> Loading…
                </div>
              )}

              {!loading && error && (
                <p style={{ color: '#EF4444', fontSize: 13, padding: '12px 10px', marginTop: 12 }}>
                  ⚠ {error}
                </p>
              )}

              {!loading && loans.length === 0 && (
                <p style={{ color: 'var(--muted)', fontSize: 14, padding: '2rem 0', textAlign: 'center' }}>
                  No loans yet. Add one to get started.
                </p>
              )}

              {!loading && loans.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
                  {loans.map(loan => {
                    const outstanding = loan.amount_received - loan.paid_amount;

                    return (
                      <div
                        key={loan.id}
                        className="card"
                        style={{ padding: '16px', marginBottom: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}
                      >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => openEditLoan(loan)}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
                              {loan.person_name}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                              Loan
                            </div>
                          </div>
                        </div>

                        {/* Main Details Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 4 }}>
                              Amount Received
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                              {INR(loan.amount_received)}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 4 }}>
                              Outstanding
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#EF4444' }}>
                              {INR(outstanding)}
                            </div>
                          </div>

                          <div style={{ gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 4 }}>
                              Total Paid
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#10B981' }}>
                              {INR(loan.paid_amount)}
                            </div>
                          </div>
                        </div>

                        {/* Date */}
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 4 }}>
                            Start Date
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                            {fmtDate(loan.start_date)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <>
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2rem 0', color: 'var(--muted)', fontSize: 14 }}>
                <Loader2 size={16} className="spin-icon" /> Loading…
              </div>
            )}

            {!loading && payments.length === 0 && (
              <p style={{ color: 'var(--muted)', fontSize: 14, padding: '2rem 0', textAlign: 'center' }}>
                No repayments yet.
              </p>
            )}

            {!loading && payments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {payments.map(payment => {
                  const loan = loans.find(l => l.id === payment.loan_id);
                  return (
                    <div key={payment.id} className="card" style={{ padding: '12px 14px', marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                            {INR(payment.amount)}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {fmtDate(payment.date)}
                          </div>
                        </div>
                        {loan && (
                          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: '4px' }}>
                            {loan.person_name}
                          </div>
                        )}
                        {payment.note && (
                          <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                            {payment.note}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => openDeletePaymentModal(payment.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--muted)',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Delete payment"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB — Add button */}
      <button
        onClick={() => activeTab === 'dashboard' ? openAddLoan() : setPayModalOpen(true)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--navy)',
          color: '#fff',
          border: 'none',
          fontSize: 24,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(49, 46, 129, 0.3)',
          zIndex: 100,
        }}
      >
        <Plus size={24} />
      </button>

      {/* Loan Modal */}
      {loanModalOpen && (
        <div className="modal-bg open">
          <div className="modal">
            <div className="modal-hd">
              <span className="modal-title">{editLoan ? 'Edit Loan' : 'Add Loan'}</span>
              <button className="modal-close" onClick={() => setLoanModalOpen(false)}>×</button>
            </div>

            <div className="modal-body">
              {error && (
                <p style={{ color: '#EF4444', fontSize: 13, padding: '12px 10px', marginBottom: 12 }}>
                  ⚠ {error}
                </p>
              )}

              <div className="form-row">
                <label className="form-lbl">Person Name *</label>
                <input
                  className="form-inp"
                  type="text"
                  placeholder="e.g. Ravi"
                  value={loanForm.person_name}
                  onChange={e => setLoanField('person_name', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label className="form-lbl">Amount Received *</label>
                <input
                  className="form-inp"
                  type="number"
                  placeholder="Amount"
                  value={loanForm.amount_received}
                  onChange={e => setLoanField('amount_received', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label className="form-lbl">Start Date *</label>
                <input
                  className="form-inp"
                  type="date"
                  value={loanForm.start_date}
                  onChange={e => setLoanField('start_date', e.target.value)}
                />
              </div>
            </div>

            <div className="modal-foot">
              <div className="modal-foot-l">
                {editLoan && (
                  <button
                    className="btn btn-sm btn-red"
                    onClick={deleteLoan}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 size={14} className="spin-icon" /> {delConfirm ? 'Deleting…' : 'Delete'}
                      </>
                    ) : (
                      <>
                        <Trash2 size={14} /> {delConfirm ? 'Confirm' : 'Delete'}
                      </>
                    )}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-sm"
                  onClick={() => setLoanModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm btn-green"
                  onClick={saveLoan}
                  disabled={saving || !loanForm.person_name.trim() || !loanForm.amount_received}
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="spin-icon" /> Saving…
                    </>
                  ) : (
                    <>
                      <Check size={14} /> {editLoan ? 'Update' : 'Add'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Payment Confirmation Modal */}
      {delPaymentModal && (
        <div className="modal-bg open">
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-hd">
              <span className="modal-title">Delete Payment</span>
              <button className="modal-close" onClick={() => setDelPaymentModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text)', fontSize: 14, margin: 0 }}>
                Are you sure you want to delete this payment?
              </p>
            </div>

            <div className="modal-foot">
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button
                  className="btn btn-sm"
                  onClick={() => setDelPaymentModal(false)}
                  disabled={delPaymentConfirm}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm btn-red"
                  onClick={confirmDeletePayment}
                  disabled={delPaymentConfirm}
                >
                  {delPaymentConfirm ? (
                    <>
                      <Loader2 size={14} className="spin-icon" /> Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} /> Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payModalOpen && (
        <div className="modal-bg open">
          <div className="modal">
            <div className="modal-hd">
              <span className="modal-title">Add Payment</span>
              <button className="modal-close" onClick={() => setPayModalOpen(false)}>×</button>
            </div>

            <div className="modal-body">
              {payError && (
                <p style={{ color: '#EF4444', fontSize: 13, padding: '12px 10px', marginBottom: 12 }}>
                  ⚠ {payError}
                </p>
              )}

              <div className="form-row">
                <label className="form-lbl">Loan *</label>
                <select
                  className="form-sel"
                  value={payLoanId}
                  onChange={e => setPayLoanId(e.target.value)}
                >
                  <option value="">Select a loan</option>
                  {loans.map(loan => (
                    <option key={loan.id} value={loan.id}>
                      {loan.person_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label className="form-lbl">Date *</label>
                <input
                  className="form-inp"
                  type="date"
                  value={payForm.date}
                  onChange={e => setPayField('date', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label className="form-lbl">Amount *</label>
                <input
                  className="form-inp"
                  type="number"
                  placeholder="Amount"
                  value={payForm.amount}
                  onChange={e => setPayField('amount', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label className="form-lbl">Note</label>
                <input
                  className="form-inp"
                  type="text"
                  placeholder="Optional note"
                  value={payForm.note}
                  onChange={e => setPayField('note', e.target.value)}
                />
              </div>
            </div>

            <div className="modal-foot">
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button
                  className="btn btn-sm"
                  onClick={() => setPayModalOpen(false)}
                  disabled={paySaving}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm btn-green"
                  onClick={savePayment}
                  disabled={paySaving || !payForm.amount}
                >
                  {paySaving ? (
                    <>
                      <Loader2 size={14} className="spin-icon" /> Saving…
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Add
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

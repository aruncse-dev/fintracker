import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Check, Trash2, Loader2, BarChart3, CreditCard, LayoutDashboard, Clock } from 'lucide-react';
import { api, RawJewelLoanRow, RawJewelLoanHistoryRow } from '../api';
import { INR } from '../utils';

// ──────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

interface JewelLoan {
  id: string;
  name: string;
  bank: string;
  principal: number;
  rate: number;
  start_date: string;
  end_date: string;
  paid_amount: number;
  status: string;
}

interface JewelLoanPayment {
  id: string;
  loan_id: string;
  date: string;
  amount: number;
  note: string;
}

interface LoanFormState {
  name: string;
  bank: string;
  principal: string;
  rate: string;
  start_date: string;
  end_date: string;
}

interface PaymentFormState {
  date: string;
  amount: string;
  note: string;
}

function emptyLoanForm(): LoanFormState {
  return {
    name: '',
    bank: '',
    principal: '',
    rate: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  };
}

function emptyPaymentForm(): PaymentFormState {
  return {
    date: new Date().toISOString().split('T')[0],
    amount: '',
    note: '',
  };
}

function parseRow(raw: RawJewelLoanRow): JewelLoan | null {
  const principal = parseFloat(String(raw.principal));
  const rate = parseFloat(String(raw.rate));
  const paid_amount = parseFloat(String(raw.paid_amount));

  if (isNaN(principal) || isNaN(paid_amount)) return null;

  return {
    id: raw.id,
    name: String(raw.name ?? '').trim(),
    bank: String(raw.bank ?? '').trim(),
    principal,
    rate: isNaN(rate) ? 0 : rate,
    start_date: String(raw.start_date ?? ''),
    end_date: String(raw.end_date ?? ''),
    paid_amount,
    status: String(raw.status ?? 'Ongoing').trim(),
  };
}

function parsePaymentRow(raw: RawJewelLoanHistoryRow): JewelLoanPayment | null {
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

export default function JewelLoans() {
  // Tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard');

  // Data
  const [loans, setLoans] = useState<JewelLoan[]>([]);
  const [payments, setPayments] = useState<JewelLoanPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Loan Modal
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [editLoan, setEditLoan] = useState<JewelLoan | null>(null);
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

  // Derivations
  const ongoingLoans = useMemo(() => loans.filter(l => l.status === 'Ongoing'), [loans]);

  const totalPrincipal = useMemo(() => {
    return loans.reduce((s, l) => s + l.principal, 0);
  }, [loans]);

  const totalPaid = useMemo(() => {
    return loans.reduce((s, l) => s + l.paid_amount, 0);
  }, [loans]);

  const totalOutstanding = useMemo(() => {
    return ongoingLoans.reduce((s, l) => {
      const interest = l.principal * (l.rate / 100);
      const total_payable = l.principal + interest;
      return s + (total_payable - l.paid_amount);
    }, 0);
  }, [ongoingLoans]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [loansData, paymentsData] = await Promise.all([
        api.getJewelLoans(),
        api.getJewelLoanHistory(),
      ]);
      setLoans(loansData.map(parseRow).filter((i): i is JewelLoan => i !== null));
      setPayments(paymentsData.map(parsePaymentRow).filter((i): i is JewelLoanPayment => i !== null));
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

  function openEditLoan(loan: JewelLoan) {
    setEditLoan(loan);
    const parsed = parseDate(loan.start_date);
    const formattedStartDate = !isNaN(parsed.getTime())
      ? `${String(parsed.getFullYear()).padStart(4, '0')}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
      : '';

    const endParsed = parseDate(loan.end_date);
    const formattedEndDate = !isNaN(endParsed.getTime())
      ? `${String(endParsed.getFullYear()).padStart(4, '0')}-${String(endParsed.getMonth() + 1).padStart(2, '0')}-${String(endParsed.getDate()).padStart(2, '0')}`
      : '';

    setLoanForm({
      name: loan.name,
      bank: loan.bank,
      principal: String(loan.principal),
      rate: String(loan.rate),
      start_date: formattedStartDate,
      end_date: formattedEndDate,
    });
    setDelConfirm(false);
    setError('');
    setLoanModalOpen(true);
  }

  async function saveLoan() {
    if (!loanForm.name.trim() || !loanForm.bank.trim() || !loanForm.principal) return;

    setSaving(true);
    const payload = {
      name: loanForm.name.trim(),
      bank: loanForm.bank.trim(),
      principal: parseFloat(loanForm.principal),
      rate: parseFloat(loanForm.rate) || 0,
      start_date: loanForm.start_date,
      end_date: loanForm.end_date,
      status: 'Ongoing',
    };

    try {
      if (editLoan) {
        await api.updateJewelLoan({ ...payload, id: editLoan.id });
      } else {
        await api.addJewelLoan(payload);
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
      await api.deleteJewelLoan(editLoan.id);
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

  function openPayModal(loanId: string) {
    setPayLoanId(loanId);
    setPayForm(emptyPaymentForm());
    setPayError('');
    setPayModalOpen(true);
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
      await api.addJewelLoanHistory(payload);
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

  async function deletePayment(paymentId: string) {
    if (delPaymentId !== paymentId) {
      setDelPaymentId(paymentId);
      setDelPaymentConfirm(false);
      return;
    }
    if (!delPaymentConfirm) {
      setDelPaymentConfirm(true);
      return;
    }

    try {
      await api.deleteJewelLoanHistory(paymentId);
      await loadData();
      setDelPaymentId(null);
      setDelPaymentConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
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
          <div className="card" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
              Total Principal (₹)
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
              {INR(totalPrincipal)}
            </div>
          </div>

          <div className="card" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
              Total Paid (₹)
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#10B981' }}>
              {INR(totalPaid)}
            </div>
          </div>

          <div className="card" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
              Total Outstanding (₹)
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#EF4444' }}>
              {INR(totalOutstanding)}
            </div>
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
                const interest = loan.principal * (loan.rate / 100);
                const total_payable = loan.principal + interest;
                const outstanding = total_payable - loan.paid_amount;

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
                          {loan.name}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                          {loan.bank}
                        </div>
                      </div>
                      <span className={`sbadge${loan.status === 'Ongoing' ? ' sbadge-green' : ' sbadge-gray'}`}>
                        {loan.status}
                      </span>
                    </div>

                    {/* Main Details Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 4 }}>
                          Principal
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                          {INR(loan.principal)}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 4 }}>
                          Interest (₹)
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                          {INR(interest)}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 4 }}>
                          Total Payable
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                          {INR(total_payable)}
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
                    </div>

                    {/* Dates & Paid Amount */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 4 }}>
                          Start Date
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                          {fmtDate(loan.start_date)}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 4 }}>
                          End Date
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                          {fmtDate(loan.end_date)}
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

                    {/* Add Payment Button */}
                    <button
                      onClick={() => openPayModal(loan.id)}
                      style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        background: 'var(--navy)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      + Add Payment
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

            {/* Repayment History Section - Only on Dashboard if exists */}
            {!loading && payments.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', marginTop: '2rem' }}>
                  <BarChart3 size={20} style={{ color: 'var(--text)' }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Recent Repayments</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {payments.slice(0, 3).map(payment => {
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
                              {loan.name}
                            </div>
                          )}
                          {payment.note && (
                            <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                              {payment.note}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
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
                  const isConfirming = delPaymentId === payment.id;
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
                            {loan.name}
                          </div>
                        )}
                        {payment.note && (
                          <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                            {payment.note}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => deletePayment(payment.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: isConfirming ? '#EF4444' : 'var(--muted)',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          flexShrink: 0,
                          fontWeight: isConfirming ? 700 : 400,
                        }}
                      >
                        {isConfirming ? 'Confirm' : 'Delete'}
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
        onClick={openAddLoan}
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
                <label className="form-lbl">Loan Name *</label>
                <input
                  className="form-inp"
                  type="text"
                  placeholder="e.g. Gold Loan"
                  value={loanForm.name}
                  onChange={e => setLoanField('name', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label className="form-lbl">Bank/Lender *</label>
                <input
                  className="form-inp"
                  type="text"
                  placeholder="e.g. Muthoot, Manappuram"
                  value={loanForm.bank}
                  onChange={e => setLoanField('bank', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label className="form-lbl">Principal Amount *</label>
                <input
                  className="form-inp"
                  type="number"
                  placeholder="Amount"
                  value={loanForm.principal}
                  onChange={e => setLoanField('principal', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label className="form-lbl">Interest Rate (%)</label>
                <input
                  className="form-inp"
                  type="number"
                  step="0.1"
                  placeholder="Rate"
                  value={loanForm.rate}
                  onChange={e => setLoanField('rate', e.target.value)}
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

              <div className="form-row">
                <label className="form-lbl">End Date *</label>
                <input
                  className="form-inp"
                  type="date"
                  value={loanForm.end_date}
                  onChange={e => setLoanField('end_date', e.target.value)}
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
                  disabled={saving || !loanForm.name.trim() || !loanForm.bank.trim() || !loanForm.principal}
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

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Check, Trash2, Loader2, BarChart3, CreditCard } from 'lucide-react';
import { api, RawEmiRow } from '../api';
import { INR } from '../utils';

// ──────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────


interface EmiLoan {
  id: string;
  name: string;
  bank: string;
  principal: number;
  rate: number;
  start_date: string;
  tenure_months: number;
  emi_amount: number;
  paid_emis: number;
  status: string;
}

interface EmiFormState {
  name: string;
  bank: string;
  principal: string;
  rate: string;
  start_date: string;
  tenure_months: string;
  emi_amount: string;
  paid_emis: string;
}

function emptyForm(): EmiFormState {
  return {
    name: '',
    bank: '',
    principal: '',
    rate: '',
    start_date: new Date().toISOString().split('T')[0],
    tenure_months: '',
    emi_amount: '',
    paid_emis: '0',
  };
}

function parseRow(raw: RawEmiRow): EmiLoan | null {
  const principal = parseFloat(String(raw.principal));
  const rate = parseFloat(String(raw.rate));
  const tenure_months = parseFloat(String(raw.tenure_months));
  const emi_amount = parseFloat(String(raw.emi_amount));
  const paid_emis = parseFloat(String(raw.paid_emis));

  if (isNaN(principal) || isNaN(tenure_months) || isNaN(emi_amount) || isNaN(paid_emis)) return null;

  return {
    id: raw.id,
    name: String(raw.name ?? '').trim(),
    bank: String(raw.bank ?? '').trim(),
    principal,
    rate: isNaN(rate) ? 0 : rate,
    start_date: String(raw.start_date ?? ''),
    tenure_months,
    emi_amount,
    paid_emis,
    status: String(raw.status ?? 'Ongoing').trim(),
  };
}

// Parse dates in multiple formats: YYYY-MM-DD, dd-MMM-yy, or ISO format
function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);

  // Remove time component if present (ISO format)
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

  // Try to parse as YYYY-MM-DD format (from form input, e.g., "2022-07-05")
  const yyyymmddRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const yyyymmddMatch = cleanDate.match(yyyymmddRegex);
  if (yyyymmddMatch) {
    const [, year, month, day] = yyyymmddMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Fallback: return invalid date
  return new Date(NaN);
}

// Calculate end date by adding months to start date
function addMonths(dateStr: string, months: number): string {
  const date = parseDate(dateStr);
  date.setMonth(date.getMonth() + months);
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

// Calculate EMI (Equated Monthly Installment)
// EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
// Where: P = Principal, r = monthly rate, n = number of months
function calculateEMI(principal: number, annualRate: number, tenure: number): number {
  if (principal <= 0 || tenure <= 0 || annualRate < 0) return 0;
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return principal / tenure; // Simple division if no interest

  const pow = Math.pow(1 + monthlyRate, tenure);
  if (!isFinite(pow)) return 0; // Handle overflow

  const numerator = monthlyRate * pow;
  const denominator = pow - 1;

  if (denominator === 0) return principal / tenure; // Fallback

  const emi = (principal * numerator) / denominator;
  return isFinite(emi) ? emi : 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────────────

export default function EMI() {
  // Data
  const [items, setItems] = useState<EmiLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<EmiLoan | null>(null);
  const [form, setForm] = useState<EmiFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const [emiManuallyEdited, setEmiManuallyEdited] = useState(false);

  // Derivations
  const ongoingLoans = useMemo(() => items.filter(l => l.status === 'Ongoing'), [items]);
  const totalOutstanding = useMemo(() => {
    return ongoingLoans.reduce((s, l) => {
      const totalPayable = l.emi_amount * l.tenure_months;
      const totalPaid = l.emi_amount * l.paid_emis;
      return s + (totalPayable - totalPaid);
    }, 0);
  }, [ongoingLoans]);

  const totalPaid = useMemo(() => {
    return items.reduce((s, l) => s + (l.emi_amount * l.paid_emis), 0);
  }, [items]);

  const totalLoanValue = useMemo(() => {
    return items.reduce((s, l) => s + (l.emi_amount * l.tenure_months), 0);
  }, [items]);

  const totalMonthlyEmis = useMemo(() => {
    return ongoingLoans.reduce((s, l) => s + l.emi_amount, 0);
  }, [ongoingLoans]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await api.getEmi();
      setItems(rows.map(parseRow).filter((i): i is EmiLoan => i !== null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load loans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Form handlers
  function setField<K extends keyof EmiFormState>(k: K, v: EmiFormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
    // Track when user manually edits emi_amount
    if (k === 'emi_amount') {
      setEmiManuallyEdited(true);
    }
  }

  // Auto-calculate EMI when principal, rate, or tenure change
  // Only auto-fill if emi_amount hasn't been manually edited
  useEffect(() => {
    const principal = parseFloat(form.principal) || 0;
    const rate = parseFloat(form.rate) || 0;
    const tenure = parseFloat(form.tenure_months) || 0;

    // Auto-fill EMI if principal & tenure are valid and emi_amount wasn't manually edited
    if (principal > 0 && tenure > 0 && !emiManuallyEdited) {
      const calculatedEmi = calculateEMI(principal, rate, tenure);
      // Round to nearest integer
      setForm(f => ({ ...f, emi_amount: String(Math.round(calculatedEmi)) }));
    }
  }, [form.principal, form.rate, form.tenure_months, emiManuallyEdited]);

  function openAdd() {
    setEditItem(null);
    setForm(emptyForm());
    setEmiManuallyEdited(false);
    setDelConfirm(false);
    setModalOpen(true);
  }

  function openEdit(item: EmiLoan) {
    setEditItem(item);
    // Convert start_date to YYYY-MM-DD format for the date input
    // API returns dates in dd-MMM-yy format (e.g., "05-Jul-22")
    const parsed = parseDate(item.start_date);
    const formattedStartDate = !isNaN(parsed.getTime())
      ? `${String(parsed.getFullYear()).padStart(4, '0')}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
      : '';

    setForm({
      name: item.name,
      bank: item.bank,
      principal: String(item.principal),
      rate: String(item.rate),
      start_date: formattedStartDate,
      tenure_months: String(item.tenure_months),
      emi_amount: String(item.emi_amount),
      paid_emis: String(item.paid_emis),
    });
    setEmiManuallyEdited(true); // In edit mode, treat existing emi_amount as manually set
    setDelConfirm(false);
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.bank.trim() || !form.principal || !form.tenure_months || !form.emi_amount) return;

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      bank: form.bank.trim(),
      principal: parseFloat(form.principal),
      rate: parseFloat(form.rate) || 0,
      start_date: form.start_date,
      tenure_months: parseFloat(form.tenure_months),
      emi_amount: parseFloat(form.emi_amount),
      paid_emis: parseFloat(form.paid_emis) || 0,
      status: 'Ongoing',
    };

    try {
      if (editItem) {
        await api.updateEmi({ ...payload, id: editItem.id });
      } else {
        await api.addEmi(payload);
      }
      setModalOpen(false);
      setEditItem(null);
      setForm(emptyForm());
      setDelConfirm(false);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem() {
    if (!delConfirm) {
      setDelConfirm(true);
      return;
    }
    if (!editItem) return;

    setSaving(true);
    try {
      await api.deleteEmi(editItem.id);
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
    <div style={{ paddingBottom: 80 }}>
      <div className="pg">
        {/* Metrics Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <BarChart3 size={20} style={{ color: 'var(--text)' }} />
          <div style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--text)' }}>Metrics</div>
        </div>

        {/* KPI Cards */}
        <div className="kpis" style={{ marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
              Monthly EMIs (₹)
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
              {INR(totalMonthlyEmis)}
            </div>
          </div>

          <div className="card" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
              Total Loan Paid (₹)
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#10B981' }}>
              {INR(totalPaid)}
            </div>
          </div>

          <div className="card" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
              Total Loan (₹)
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
              {INR(totalLoanValue)}
            </div>
          </div>

          <div className="card" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
              Outstanding (₹)
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

          {!loading && items.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: 14, padding: '2rem 0', textAlign: 'center' }}>
              No loans yet. Add one to get started.
            </p>
          )}

          {!loading && items.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
              {items.map(loan => {
                const totalPayable = loan.emi_amount * loan.tenure_months;
                const totalPaid = loan.emi_amount * loan.paid_emis;
                const outstanding = totalPayable - totalPaid;
                const endDate = addMonths(loan.start_date, loan.tenure_months);

                return (
                  <div
                    key={loan.id}
                    className="card"
                    onClick={() => openEdit(loan)}
                    style={{ cursor: 'pointer', padding: '16px', marginBottom: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
                          Monthly EMI
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                          {INR(loan.emi_amount)}
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

                      <div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 4 }}>
                          Progress
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                          {loan.paid_emis}/{loan.tenure_months}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 4 }}>
                          Ends
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                          {fmtDate(endDate)}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Details */}
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
                          Interest Rate
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                          {loan.rate}%
                        </div>
                      </div>

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
                          Total Paid
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#10B981' }}>
                          {INR(totalPaid)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FAB — Add button */}
      <button
        onClick={openAdd}
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

      {/* Modal */}
      {modalOpen && (
        <div className="modal-bg open">
          <div className="modal">
            <div className="modal-hd">
              <span className="modal-title">{editItem ? 'Edit Loan' : 'Add Loan'}</span>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
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
                  placeholder="e.g. Home Loan"
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label className="form-lbl">Bank/Lender *</label>
                <input
                  className="form-inp"
                  type="text"
                  placeholder="e.g. SBI, HDFC"
                  value={form.bank}
                  onChange={e => setField('bank', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label className="form-lbl">Principal Amount *</label>
                <input
                  className="form-inp"
                  type="number"
                  placeholder="Amount"
                  value={form.principal}
                  onChange={e => setField('principal', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label className="form-lbl">Interest Rate (%)</label>
                <input
                  className="form-inp"
                  type="number"
                  step="0.1"
                  placeholder="Rate"
                  value={form.rate}
                  onChange={e => setField('rate', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label className="form-lbl">Start Date *</label>
                <input
                  className="form-inp"
                  type="date"
                  value={form.start_date}
                  onChange={e => setField('start_date', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label className="form-lbl">Tenure (Months) *</label>
                <input
                  className="form-inp"
                  type="number"
                  placeholder="e.g. 240 for 20 years"
                  value={form.tenure_months}
                  onChange={e => setField('tenure_months', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label className="form-lbl">EMI Amount *</label>
                <input
                  className="form-inp"
                  type="number"
                  placeholder="Monthly EMI"
                  value={form.emi_amount}
                  onChange={e => setField('emi_amount', e.target.value)}
                />
                {form.principal && form.tenure_months ? (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                    Suggested: ₹{Math.round(calculateEMI(parseFloat(form.principal) || 0, parseFloat(form.rate) || 0, parseFloat(form.tenure_months) || 0))} (auto-fills when empty)
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                    Fill principal & tenure to auto-calculate
                  </div>
                )}
              </div>

              <div className="form-row">
                <label className="form-lbl">Paid EMIs</label>
                <input
                  className="form-inp"
                  type="number"
                  placeholder="0"
                  value={form.paid_emis}
                  onChange={e => setField('paid_emis', e.target.value)}
                />
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                  Will auto-increment monthly based on start date
                </div>
              </div>
            </div>

            <div className="modal-foot">
              <div className="modal-foot-l">
                {editItem && (
                  <button
                    className="btn btn-sm btn-red"
                    onClick={deleteItem}
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
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm btn-green"
                  onClick={save}
                  disabled={saving || !form.name.trim() || !form.bank.trim() || !form.principal || !form.tenure_months || !form.emi_amount}
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="spin-icon" /> Saving…
                    </>
                  ) : (
                    <>
                      <Check size={14} /> {editItem ? 'Update' : 'Add'}
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

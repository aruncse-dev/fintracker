import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Check, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { api, RawLendingRow } from '../api'

type LendType = 'LEND' | 'REPAY'

interface LendingEntry {
  id: string
  date: string
  name: string
  amount: number
  type: LendType
  description: string
}

interface FormState {
  type: LendType
  name: string
  amount: string
  date: string
  description: string
}

function todayISO() { return new Date().toISOString().split('T')[0] }
function toDateInput(dateStr: string): string {
  try {
    return new Date(dateStr).toISOString().split('T')[0]
  } catch {
    return todayISO()
  }
}
function emptyForm(): FormState { return { type: 'LEND', name: '', amount: '', date: todayISO(), description: '' } }
function INR(n: number) { return '₹' + n.toLocaleString('en-IN') }

function parseRow(raw: RawLendingRow): LendingEntry | null {
  const type = String(raw.type ?? '').trim().toUpperCase()
  if (type !== 'LEND' && type !== 'REPAY') return null
  const amount = parseFloat(String(raw.amount))
  if (isNaN(amount)) return null
  return {
    id: raw.id,
    date: String(raw.date ?? '').trim(),
    name: String(raw.name ?? '').trim(),
    amount,
    type: type as LendType,
    description: String(raw.description ?? '').trim(),
  }
}

interface PersonTotal {
  name: string
  outstanding: number
  count: number
}

function groupByPerson(entries: LendingEntry[]): PersonTotal[] {
  const grouped = new Map<string, { lend: number; repay: number; count: number }>()

  entries.forEach(e => {
    const existing = grouped.get(e.name) || { lend: 0, repay: 0, count: 0 }
    if (e.type === 'LEND') existing.lend += e.amount
    else existing.repay += e.amount
    existing.count += 1
    grouped.set(e.name, existing)
  })

  return Array.from(grouped.entries())
    .map(([name, { lend, repay, count }]) => ({
      name,
      outstanding: lend - repay,
      count,
    }))
    .sort((a, b) => Math.abs(b.outstanding) - Math.abs(a.outstanding))
}

export default function Lending() {
  const [entries, setEntries] = useState<LendingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<LendingEntry | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'lending' | 'repayments'>('dashboard')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await api.getLending()
      setEntries(rows.map(parseRow).filter((e): e is LendingEntry => e !== null))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function set(k: keyof FormState, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function openAdd() {
    setEditEntry(null)
    setForm(emptyForm())
    setDelConfirm(false)
    setModalOpen(true)
  }

  function openEdit(e: LendingEntry) {
    setEditEntry(e)
    setForm({ type: e.type, name: e.name, amount: String(e.amount), date: toDateInput(e.date), description: e.description })
    setDelConfirm(false)
    setModalOpen(true)
  }

  async function save() {
    if (!form.name.trim() || !form.amount) return
    setSaving(true)
    const p = { date: form.date, name: form.name.trim(), amount: parseFloat(form.amount), type: form.type, description: form.description.trim() }
    try {
      if (editEntry) await api.updateLending({ ...p, id: editEntry.id })
      else await api.addLending(p)
      setModalOpen(false)
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function del() {
    if (!delConfirm) { setDelConfirm(true); return }
    if (!editEntry) return
    setSaving(true)
    try {
      await api.deleteLending(editEntry.id)
      setModalOpen(false)
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const totalLent   = entries.filter(e => e.type === 'LEND').reduce((s, e) => s + e.amount, 0)
  const totalRepaid = entries.filter(e => e.type === 'REPAY').reduce((s, e) => s + e.amount, 0)
  const outstanding = totalLent - totalRepaid

  const filteredEntries = tab === 'lending' ? entries.filter(e => e.type === 'LEND') : tab === 'repayments' ? entries.filter(e => e.type === 'REPAY') : entries

  return (
    <div className="pg">
      {/* Tab Navigation */}
      <div className="tab-bar" style={{ marginBottom: 16 }}>
        {['dashboard', 'lending', 'repayments'].map(tabName => (
          <button
            key={tabName}
            className={`tab-item ${tab === tabName ? 'active' : ''}`}
            onClick={() => setTab(tabName as typeof tab)}
            style={{ flex: 1, textTransform: 'capitalize' }}
          >
            {tabName}
          </button>
        ))}
      </div>
      {/* Summary */}
      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="card" style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Lent Out</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{INR(totalLent)}</div>
        </div>
        <div className="card" style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Repaid</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#10B981', marginTop: 2 }}>{INR(totalRepaid)}</div>
        </div>
        <div className="card" style={{ padding: '10px 14px', gridColumn: 'span 2' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Outstanding</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: outstanding > 0 ? '#F59E0B' : 'var(--text)', marginTop: 2 }}>{INR(outstanding)}</div>
        </div>
      </div>

      {/* Summary by Person - Dashboard only */}
      {!loading && entries.length > 0 && tab === 'dashboard' && (
        <div className="sec" style={{ marginBottom: 20 }}>
          <div className="sec-h">Per Person</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {groupByPerson(entries).map(person => (
              <div
                key={person.name}
                className="card"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{person.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{person.count} transaction{person.count !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: person.outstanding > 0 ? '#EF4444' : person.outstanding < 0 ? '#10B981' : 'var(--text)' }}>
                    {INR(Math.abs(person.outstanding))}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                    {person.outstanding > 0 ? 'to receive' : person.outstanding < 0 ? 'to pay' : 'settled'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entries */}
      <div className="sec">
        <div className="sec-h" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{tab === 'dashboard' ? 'All Entries' : tab === 'lending' ? 'Lending' : 'Repayments'}</span>
          <button className="btn btn-sm" style={{ gap: 5 }} onClick={openAdd}>
            <Plus size={14} /> Add
          </button>
        </div>

        {error && <p style={{ color: '#EF4444', fontSize: 13, padding: '8px 0' }}>⚠ {error}</p>}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '1rem 0', color: 'var(--muted)', fontSize: 14 }}>
            <Loader2 size={16} className="spin-icon" /> Loading…
          </div>
        ) : filteredEntries.length === 0 ? (
          <p style={{ color: 'var(--muted)', padding: '1rem 0', fontSize: 14 }}>No entries yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {filteredEntries.map(e => (
              <div
                key={e.id}
                className="card"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
                onClick={() => openEdit(e)}
              >
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                  background: e.type === 'LEND' ? 'rgba(239,68,68,.12)' : 'rgba(16,185,129,.12)',
                  color: e.type === 'LEND' ? '#EF4444' : '#10B981',
                  flexShrink: 0,
                }}>
                  {e.type}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                  {e.description && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{e.description}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: e.type === 'LEND' ? '#EF4444' : '#10B981' }}>{INR(e.amount)}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{e.date}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-bg open" onClick={ev => { if (ev.target === ev.currentTarget) setModalOpen(false) }}>
          <div className="modal">
            <div className="modal-hd">
              <span className="modal-title">{editEntry ? 'Edit Entry' : 'Add Entry'}</span>
              <button className="modal-close" onClick={() => setModalOpen(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label className="form-lbl">Type</label>
                <select className="form-sel" value={form.type} onChange={e => set('type', e.target.value as LendType)}>
                  <option value="LEND">LEND</option>
                  <option value="REPAY">REPAY</option>
                </select>
              </div>
              <div className="form-row">
                <label className="form-lbl">Name</label>
                <input className="form-inp" type="text" placeholder="Who?" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-lbl">Amount (₹)</label>
                <input className="form-inp mono" type="number" min="0" step="1" placeholder="0" value={form.amount} onChange={e => set('amount', e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-lbl">Date</label>
                <input className="form-inp" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-lbl">Description</label>
                <input className="form-inp" type="text" placeholder="Optional" value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
            </div>
            <div className="modal-foot">
              <div className="modal-foot-l">
                {editEntry && (
                  <button className="btn btn-red btn-sm" onClick={del} disabled={saving}>
                    {delConfirm ? <><AlertTriangle size={14} />Confirm?</> : <><Trash2 size={14} />Delete</>}
                  </button>
                )}
              </div>
              <button className="btn btn-sm" style={{ background: 'var(--border)', color: 'var(--text)' }} onClick={() => setModalOpen(false)}>
                <X size={14} /> Cancel
              </button>
              <button className="btn btn-sm btn-green" onClick={save} disabled={saving || !form.name.trim() || !form.amount}>
                {saving ? <Loader2 size={14} className="spin-icon" /> : editEntry ? <><Check size={14} />Save</> : <><Plus size={14} />Add</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

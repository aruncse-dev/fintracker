import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Plus, X, Check, Trash2, AlertTriangle, Loader2, Search, LayoutDashboard, Handshake, ArrowDownLeft } from 'lucide-react'
import { api, RawLendingRow } from '../api'
import { INR } from '../utils'

type LendType = 'LEND' | 'RECEIVED'
type LendTab = 'dashboard' | 'lended' | 'received'

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

interface PersonDetails {
  name: string
  totalLent: number
  totalRepaid: number
  outstanding: number
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

function parseRow(raw: RawLendingRow): LendingEntry | null {
  let type = String(raw.type ?? '').trim().toUpperCase()
  if (type !== 'LEND' && type !== 'REPAY' && type !== 'RECEIVED') return null
  // Map backend REPAY to frontend RECEIVED
  if (type === 'REPAY') type = 'RECEIVED'
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

function aggregateByPerson(entries: LendingEntry[]): PersonDetails[] {
  const grouped = new Map<string, { lend: number; repay: number }>()

  entries.forEach(e => {
    const existing = grouped.get(e.name) || { lend: 0, repay: 0 }
    if (e.type === 'LEND') existing.lend += e.amount
    else existing.repay += e.amount
    grouped.set(e.name, existing)
  })

  return Array.from(grouped.entries())
    .map(([name, { lend, repay }]) => ({
      name,
      totalLent: lend,
      totalRepaid: repay,
      outstanding: lend - repay,
    }))
    .sort((a, b) => Math.abs(b.outstanding) - Math.abs(a.outstanding))
}

interface PersonCardProps {
  person: PersonDetails
  onClick: () => void
}

const PersonCard = memo(function PersonCard({ person, onClick }: PersonCardProps) {
  return (
    <div
      onClick={onClick}
      className="card"
      style={{
        padding: '16px 14px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'all 0.15s ease',
      }}
      onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
      onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
            {person.name}
          </div>
        </div>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          padding: '4px 8px',
          borderRadius: 4,
          background: person.outstanding > 0 ? 'rgba(239, 68, 68, 0.1)' : person.outstanding < 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
          color: person.outstanding > 0 ? '#EF4444' : person.outstanding < 0 ? '#10B981' : 'var(--text)',
        }}>
          {person.outstanding > 0 ? 'LENT' : person.outstanding < 0 ? 'CLEAR' : 'SETTLED'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Lent
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {INR(person.totalLent)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Received
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {INR(person.totalRepaid)}
          </div>
        </div>
      </div>

      <div style={{
        padding: '10px 12px',
        background: person.outstanding > 0 ? 'rgba(239, 68, 68, 0.08)' : person.outstanding < 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(107, 114, 128, 0.05)',
        borderRadius: 8,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Outstanding
        </div>
        <div style={{
          fontSize: 16,
          fontWeight: 700,
          color: person.outstanding > 0 ? '#EF4444' : person.outstanding < 0 ? '#10B981' : 'var(--text)',
        }}>
          {INR(Math.abs(person.outstanding))}
        </div>
      </div>
    </div>
  )
})

export default function Lending() {
  const [entries, setEntries] = useState<LendingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<LendingEntry | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState<LendTab>('dashboard')
  const [search, setSearch] = useState('')
  const [personModalOpen, setPersonModalOpen] = useState(false)
  const [personModalName, setPersonModalName] = useState<string | null>(null)

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

  // Memoize aggregated data to prevent unnecessary recalculations
  const people = useMemo(() => aggregateByPerson(entries), [entries])

  const totalLent = useMemo(() =>
    entries.filter(e => e.type === 'LEND').reduce((s, e) => s + e.amount, 0),
    [entries]
  )

  const totalRepaid = useMemo(() =>
    entries.filter(e => e.type === 'RECEIVED').reduce((s, e) => s + e.amount, 0),
    [entries]
  )

  const personModalEntries = useMemo(() => {
    if (!personModalName) return []
    return entries.filter(e => e.name === personModalName).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [entries, personModalName])

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
    // Convert RECEIVED back to REPAY for API
    const apiType = form.type === 'RECEIVED' ? 'REPAY' : form.type
    const p = { date: form.date, name: form.name.trim(), amount: parseFloat(form.amount), type: apiType, description: form.description.trim() }
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

  const outstanding = totalLent - totalRepaid

  // Filter people based on search
  const filteredPeople = useMemo(() => {
    return people.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  }, [people, search])

  // Get people based on active tab
  const displayedPeople = useMemo(() => {
    if (activeTab === 'dashboard') return filteredPeople
    if (activeTab === 'lended') return filteredPeople.filter(p => p.outstanding > 0)
    if (activeTab === 'received') {
      return entries.filter(e => e.type === 'RECEIVED').map(e => e.name)
        .filter((name, idx, arr) => arr.indexOf(name) === idx) // unique names
        .map(name => filteredPeople.find(p => p.name === name))
        .filter((p): p is PersonDetails => p !== undefined)
    }
    return filteredPeople
  }, [filteredPeople, activeTab, entries])

  // Get person details for the bottom sheet
  const personDetails = personModalName ? people.find(p => p.name === personModalName) : null

  const TAB_CONFIG = [
    { id: 'dashboard' as const, icon: <LayoutDashboard size={19} />, label: 'Dashboard' },
    { id: 'lended' as const, icon: <Handshake size={19} />, label: 'Lended' },
    { id: 'received' as const, icon: <ArrowDownLeft size={19} />, label: 'Received' },
  ]

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Tab Navigation - BottomNav style */}
      <nav className="tab-bar" style={{ marginBottom: 0 }}>
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.id}
            className={`tab-item${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0, background: 'var(--card)', padding: '8px 12px', borderRadius: 0, border: 'none', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <Search size={16} style={{ color: 'var(--muted)' }} />
        <input
          type="text"
          placeholder="Search people..."
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
          <button
            onClick={() => setSearch('')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <>
          <div className="kpis" style={{ marginBottom: 0, padding: '12px 10px' }}>
            <div className="card" style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Total Lent</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{INR(totalLent)}</div>
            </div>
            <div className="card" style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Received</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#10B981', marginTop: 2 }}>{INR(totalRepaid)}</div>
            </div>
            <div className="card" style={{ padding: '10px 14px', gridColumn: 'span 2' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Total Outstanding</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: outstanding > 0 ? '#F59E0B' : 'var(--text)', marginTop: 2 }}>{INR(outstanding)}</div>
            </div>
          </div>
        </>
      )}

      {error && <p style={{ color: '#EF4444', fontSize: 13, padding: '12px 10px' }}>⚠ {error}</p>}

      {/* Person Cards */}
      <div className="sec" style={{ padding: '0 10px', margin: 0 }}>
        <div className="sec-h" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            {activeTab === 'dashboard' ? 'People' : activeTab === 'lended' ? 'Lended' : 'Received'} ({displayedPeople.length})
          </span>
          <button className="btn btn-sm" style={{ gap: 5 }} onClick={openAdd}>
            <Plus size={14} /> Add
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '1rem 0', color: 'var(--muted)', fontSize: 14 }}>
            <Loader2 size={16} className="spin-icon" /> Loading…
          </div>
        ) : displayedPeople.length === 0 ? (
          <p style={{ color: 'var(--muted)', padding: '1rem 0', fontSize: 14 }}>
            {search ? 'No matches found.' : 'No data to display.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {displayedPeople.map(person => (
              <PersonCard
                key={person.name}
                person={person}
                onClick={() => {
                  setPersonModalName(person.name)
                  setPersonModalOpen(true)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
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
                  <option value="RECEIVED">RECEIVED</option>
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

      {/* Person Details Bottom Sheet Modal */}
      {personModalOpen && personModalName && personDetails && (
        <div
          className="modal-bg open"
          onClick={ev => { if (ev.target === ev.currentTarget) setPersonModalOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
        >
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--card)',
              borderRadius: '16px 16px 0 0',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideUp 0.3s ease-out',
              zIndex: 1001,
            }}
          >
            {/* Handle Bar */}
            <div style={{ padding: '12px 0', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto' }} />
            </div>

            {/* Header with close button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                {personModalName}
              </h3>
              <button
                className="modal-close"
                onClick={() => setPersonModalOpen(false)}
                style={{ padding: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Person Stats */}
            <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div className="card" style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Lent
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>
                  {INR(personDetails.totalLent)}
                </div>
              </div>
              <div className="card" style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Received
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>
                  {INR(personDetails.totalRepaid)}
                </div>
              </div>
              <div className="card" style={{ padding: '10px 12px', background: personDetails.outstanding > 0 ? 'rgba(239, 68, 68, 0.08)' : personDetails.outstanding < 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(107, 114, 128, 0.05)' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Outstanding
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: personDetails.outstanding > 0 ? '#EF4444' : personDetails.outstanding < 0 ? '#10B981' : 'var(--text)', marginTop: 4 }}>
                  {INR(Math.abs(personDetails.outstanding))}
                </div>
              </div>
            </div>

            {/* Transactions List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
              {personModalEntries.length === 0 ? (
                <p style={{ color: 'var(--muted)', padding: '1rem 0', fontSize: 14, textAlign: 'center' }}>
                  No entries for this person.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {personModalEntries.map(e => (
                    <div
                      key={e.id}
                      className="card"
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer' }}
                      onClick={() => {
                        openEdit(e)
                        setPersonModalOpen(false)
                      }}
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
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                          {e.type === 'LEND' ? 'Lent' : 'Received'}
                        </div>
                        {e.description && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{e.description}</div>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: e.type === 'LEND' ? '#EF4444' : '#10B981' }}>
                          {INR(e.amount)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{e.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

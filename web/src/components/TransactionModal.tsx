import { useState } from 'react'
import { X, Trash2, Check, Plus, AlertTriangle, Loader2 } from 'lucide-react'
import { Transaction, TransactionForm } from '../types'
import { api } from '../api'
import { CATEGORIES, INCOME_CATS, ACCOUNTS, CC_MODES, OTHER_CR } from '../constants'

const ALL_MODES = [...ACCOUNTS, ...CC_MODES, ...OTHER_CR]
const ALL_CATS = [...CATEGORIES, ...INCOME_CATS]

interface Props {
  row: Transaction | null
  month: string; year: string
  onClose: () => void
  onSaved: () => void
  showStatus: (msg: string) => void
}

function todayISO() { return new Date().toISOString().split('T')[0] }
function gasDate(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d}-${months[parseInt(m)-1]}-${y.slice(2)}`
}
function isoFromGas(s: string) {
  if (!s) return todayISO()
  const months: Record<string,string> = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'}
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/)
  if (!m) return todayISO()
  return `20${m[3]}-${months[m[2]]}-${m[1].padStart(2,'0')}`
}

export default function TransactionModal({ row, month, year, onClose, onSaved, showStatus }: Props) {
  const isEdit = !!row
  const [form, setForm] = useState<TransactionForm>({
    date: row ? isoFromGas(row.date) : todayISO(),
    desc: row?.desc || '',
    a: row ? String(row.a) : '',
    c: row?.c || 'Groceries',
    t: row?.t || 'Expense',
    m: row?.m || 'Cash',
    notes: row?.notes || '',
    toAcct: row?.notes?.match(/^→(.+?)( ·|$)/)?.[1] || ACCOUNTS[0],
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)

  const isTransfer = form.t === 'Transfer'
  const cats = form.t === 'Income' ? ALL_CATS : CATEGORIES

  function set(k: keyof TransactionForm, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function save() {
    if (!form.desc.trim() || !form.a) { showStatus('⚠ Fill all fields'); return }
    setSaving(true)
    const notes = isTransfer ? `→${form.toAcct || ''}${form.notes ? ' · ' + form.notes : ''}` : form.notes
    const p = { month, year, date: gasDate(form.date), desc: form.desc.trim(), a: parseFloat(form.a), c: isTransfer ? 'Transfer' : form.c, t: form.t, m: form.m, notes }
    try {
      if (isEdit && row) await api.updateRow({ ...p, id: row.id })
      else await api.addRow(p)
      onSaved()
    } catch (e) {
      showStatus('⚠ ' + (e instanceof Error ? e.message : 'Save failed'))
    } finally { setSaving(false) }
  }

  async function del() {
    if (!delConfirm) { setDelConfirm(true); return }
    if (!row) return
    setDeleting(true)
    try { await api.deleteRow(month, year, row.id); onSaved() }
    catch (e) { showStatus('⚠ ' + (e instanceof Error ? e.message : 'Delete failed')); setDeleting(false) }
  }

  return (
    <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-hd">
          <span className="modal-title">{isEdit ? 'Edit Transaction' : 'Add Transaction'}</span>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label className="form-lbl">Date</label>
            <input className="form-inp" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-lbl">Amount (₹)</label>
            <input className="form-inp mono" type="number" min="0" step="1" placeholder="0" value={form.a} onChange={e => set('a', e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-lbl">Description</label>
            <input className="form-inp" type="text" placeholder="What was this for?" value={form.desc} onChange={e => set('desc', e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-lbl">Type</label>
            <select className="form-sel" value={form.t} onChange={e => set('t', e.target.value)}>
              <option>Expense</option>
              <option>Income</option>
              <option>Transfer</option>
            </select>
          </div>
          {!isTransfer && (
            <div className="form-row">
              <label className="form-lbl">Category</label>
              <select className="form-sel" value={form.c} onChange={e => set('c', e.target.value)}>
                {cats.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div className="form-row">
            <label className="form-lbl">Mode / Account</label>
            <select className="form-sel" value={form.m} onChange={e => set('m', e.target.value)}>
              {ALL_MODES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          {isTransfer && (
            <div className="form-row">
              <label className="form-lbl">Transfer To</label>
              <select className="form-sel" value={form.toAcct} onChange={e => set('toAcct', e.target.value)}>
                {ACCOUNTS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
          )}
          <div className="form-row">
            <label className="form-lbl">Notes</label>
            <input className="form-inp" type="text" placeholder="Optional notes" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <div className="modal-foot-l">
            {isEdit && (
              <button className="btn btn-red btn-sm" onClick={del} disabled={deleting}>
                {deleting ? <Loader2 size={14} className="spin-icon" /> : delConfirm ? <><AlertTriangle size={14} />Confirm?</> : <><Trash2 size={14} />Delete</>}
              </button>
            )}
          </div>
          <button className="btn btn-sm" style={{background:'var(--border)',color:'var(--text)'}} onClick={onClose}><X size={14} />Cancel</button>
          <button className="btn btn-sm btn-green" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={14} className="spin-icon" /> : isEdit ? <><Check size={14} />Save</> : <><Plus size={14} />Add</>}
          </button>
        </div>
      </div>
    </div>
  )
}

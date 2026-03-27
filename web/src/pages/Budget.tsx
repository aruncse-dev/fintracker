import { useState, useCallback } from 'react'
import { Pencil, Trash2, Plus, RotateCcw, Check, X, AlertTriangle } from 'lucide-react'
import { useStore } from '../store'
import { catMap, budgetSummary, INR, catIcon } from '../utils'
import { api } from '../api'
import { CATEGORIES } from '../constants'

interface Props { showStatus: (msg: string) => void; onCategoryClick: (cat: string) => void }

type ModalMode = 'add' | 'edit' | 'delete' | 'reset' | null
interface ModalState { mode: ModalMode; cat: string; val: string }

export default function Budget({ showStatus, onCategoryClick }: Props) {
  const { state, dispatch } = useStore()
  const { budget, rows } = state
  const cm = catMap(rows, budget)
  const { totalBudget, totalSpent, ovCount, totalOver, totalPct, tCol } = budgetSummary(budget, cm)
  const active = Object.entries(budget).filter(([,b]) => b > 0)
  const [modal, setModal] = useState<ModalState>({ mode: null, cat: '', val: '' })
  const [saving, setSaving] = useState(false)

  function openAdd() { setModal({ mode: 'add', cat: CATEGORIES[0], val: '' }) }
  function openEdit(cat: string, budg: number) { setModal({ mode: 'edit', cat, val: String(budg) }) }
  function openDelete(cat: string) { setModal({ mode: 'delete', cat, val: '' }) }
  function closeModal() { setModal({ mode: null, cat: '', val: '' }) }

  const saveBudget = useCallback(async (newBudget: Record<string,number>) => {
    setSaving(true)
    try {
      await api.saveBudget(newBudget)
      dispatch({ type:'SET_BUDGET', payload: newBudget })
      showStatus('✓ Budget saved')
    } catch (e) {
      showStatus('⚠ ' + (e instanceof Error ? e.message : 'Save failed'))
    } finally { setSaving(false) }
  }, [dispatch, showStatus])

  async function confirmAdd() {
    const val = parseFloat(modal.val)
    if (!modal.cat || isNaN(val) || val <= 0) { showStatus('⚠ Enter category and amount'); return }
    await saveBudget({ ...budget, [modal.cat]: val })
    closeModal()
  }

  async function confirmEdit() {
    const val = parseFloat(modal.val)
    if (isNaN(val)) { closeModal(); return }
    await saveBudget({ ...budget, [modal.cat]: val })
    closeModal()
  }

  async function confirmDelete() {
    const nb = { ...budget }
    delete nb[modal.cat]
    await saveBudget(nb)
    closeModal()
  }

  async function confirmReset() {
    closeModal()
    setSaving(true)
    try {
      const def = await api.resetBudget()
      dispatch({ type:'SET_BUDGET', payload: def })
      showStatus('✓ Budget reset to defaults')
    } catch (e) {
      showStatus('⚠ ' + (e instanceof Error ? e.message : 'Reset failed'))
    } finally { setSaving(false) }
  }

  return (
    <div className="pg">
      <div className="sec" style={{marginTop:12}}>
        <span className="sec-h">Budget Management</span>
        <div style={{display:'flex',gap:6}}>
          <button className="btn btn-sm btn-green" onClick={openAdd}><Plus size={14} />Add</button>
          <button className="btn btn-sm" style={{background:'var(--border)',color:'var(--text)'}} disabled={saving} onClick={() => setModal({ mode:'reset', cat:'', val:'' })}><RotateCcw size={13} />Reset</button>
        </div>
      </div>

      {/* Summary card */}
      <div className="card cp" style={{marginBottom:10,borderLeft:`4px solid ${tCol}`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
          <span style={{fontSize:12,fontWeight:700}}>📦 Total Budget</span>
          <span className="mono" style={{fontSize:12,fontWeight:700,color:totalOver?'var(--red)':'var(--green)'}}>{INR(totalSpent)} / {INR(totalBudget)}</span>
        </div>
        <div className="bar-bg" style={{height:8}}><div className="bar-f" style={{width:`${totalPct}%`,background:tCol}} /></div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:5,fontSize:11,color:'var(--muted)'}}>
          <span>{Math.round(totalPct)}% used · <span style={{color:ovCount?'var(--red)':'var(--green)',fontWeight:ovCount?700:400}}>{ovCount} overspent</span></span>
          <span>{totalOver?'🔴 Over '+INR(totalSpent-totalBudget):'✅ '+INR(totalBudget-totalSpent)+' left'}</span>
        </div>
      </div>

      {/* Budget rows */}
      <div className="bud-wrap">
        {active.sort((a,b)=>(cm[b[0]]||0)-(cm[a[0]]||0)).map(([cat, budg]) => {
          const spent = cm[cat] || 0
          const over = spent > budg
          const pct = Math.min(spent / budg * 100, 100)
          const col = over ? 'var(--rm)' : pct > 80 ? '#F59E0B' : 'var(--gm)'
          return (
            <div key={cat} className={`bud-row ${over?'ov-row':''}`}>
              <div className="bud-row-body">
                <div className="bud-row-head">
                  <span className="bud-row-name" style={{cursor:'pointer'}} onClick={() => onCategoryClick(cat)}>{catIcon(cat)}{cat} <span style={{fontSize:10,opacity:.5}}>↗</span></span>
                  <span className={`bud-row-rest ${over?'ov-amt':'ok-amt'}`}>
                    {over ? `−${INR(spent-budg)} over` : `${INR(budg-spent)} left`}
                  </span>
                </div>
                <div className="bar-bg" style={{height:5}}><div className="bar-f" style={{width:`${pct}%`,background:col}} /></div>
                <div className="bud-row-meta">
                  <span>{INR(spent)} spent</span>
                  <span className="bamt mono">{INR(budg)}</span>
                </div>
              </div>
              <div className="bud-actions">
                <button className="icon-btn" onClick={() => openEdit(cat, budg)}><Pencil size={14} /></button>
                <button className="icon-btn" style={{color:'var(--red)'}} onClick={() => openDelete(cat)}><Trash2 size={14} /></button>
              </div>
            </div>
          )
        })}
        {!active.length && <div className="lb">No budget categories. Click "+ Add".</div>}
      </div>

      {/* Modal */}
      <div className={`modal-bg ${modal.mode ? 'open' : ''}`} onClick={closeModal}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          {modal.mode === 'reset' ? (
            <>
              <div className="modal-hd">
                <span className="modal-title" style={{display:'flex',alignItems:'center',gap:6}}>
                  <RotateCcw size={15} /> Reset Budgets
                </span>
                <button className="modal-close" onClick={closeModal}><X size={16} /></button>
              </div>
              <div className="modal-body">
                <div style={{fontSize:14,color:'var(--text)'}}>
                  Reset all budget amounts to default values? Your transactions will not be affected.
                </div>
              </div>
              <div className="modal-foot">
                <div className="modal-foot-l" />
                <button className="btn btn-sm" style={{background:'var(--border)',color:'var(--text)'}} onClick={closeModal}><X size={13} />Cancel</button>
                <button className="btn btn-sm" style={{background:'var(--amber)',color:'#fff'}} onClick={confirmReset} disabled={saving}>
                  <RotateCcw size={13} />{saving ? '…' : 'Reset'}
                </button>
              </div>
            </>
          ) : modal.mode === 'delete' ? (
            <>
              <div className="modal-hd">
                <span className="modal-title" style={{display:'flex',alignItems:'center',gap:6}}>
                  <AlertTriangle size={16} /> Remove Budget
                </span>
                <button className="modal-close" onClick={closeModal}><X size={16} /></button>
              </div>
              <div className="modal-body">
                <div style={{fontSize:14,color:'var(--text)'}}>
                  Remove budget for <b>{catIcon(modal.cat)}{modal.cat}</b>? This will not delete transactions.
                </div>
              </div>
              <div className="modal-foot">
                <div className="modal-foot-l" />
                <button className="btn btn-sm" style={{background:'var(--border)',color:'var(--text)'}} onClick={closeModal}><X size={13} />Cancel</button>
                <button className="btn btn-sm" style={{background:'var(--red)',color:'#fff'}} onClick={confirmDelete} disabled={saving}>
                  <Trash2 size={13} />{saving ? '…' : 'Remove'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="modal-hd">
                <span className="modal-title" style={{display:'flex',alignItems:'center',gap:6}}>
                  {modal.mode === 'add' ? <><Plus size={15} />Add Budget</> : <><Pencil size={14} />Edit Budget</>}
                </span>
                <button className="modal-close" onClick={closeModal}><X size={16} /></button>
              </div>
              <div className="modal-body">
                {modal.mode === 'add' ? (
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>Category</div>
                    <select className="form-sel" value={modal.cat} onChange={e => setModal(m => ({...m, cat: e.target.value}))}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                ) : (
                  <div style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>
                    {catIcon(modal.cat)}{modal.cat}
                  </div>
                )}
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>Budget Amount (₹)</div>
                  <input
                    className="form-inp mono" type="number" placeholder="0"
                    value={modal.val} autoFocus
                    onChange={e => setModal(m => ({...m, val: e.target.value}))}
                    onKeyDown={e => { if (e.key === 'Enter') { modal.mode === 'add' ? confirmAdd() : confirmEdit() } }}
                  />
                </div>
              </div>
              <div className="modal-foot">
                <div className="modal-foot-l" />
                <button className="btn btn-sm" style={{background:'var(--border)',color:'var(--text)'}} onClick={closeModal}><X size={13} />Cancel</button>
                <button className="btn btn-sm btn-green" onClick={modal.mode === 'add' ? confirmAdd : confirmEdit} disabled={saving}>
                  <Check size={13} />{saving ? '…' : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

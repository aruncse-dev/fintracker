import { useState } from 'react'
import { Pencil, Trash2, Plus, RotateCcw, Check, X as XIcon, AlertTriangle, Package } from 'lucide-react'
import { useStore } from '../store'
import { catMap, budgetSummary, INR } from '../utils'
import { api } from '../api'
import { CATEGORIES } from '../constants'
import CatIcon from '../components/CatIcon'

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
  const [catSheet, setCatSheet] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  function openAdd() { setModal({ mode: 'add', cat: CATEGORIES[0], val: '' }) }
  function openEdit(cat: string, budg: number) { setModal({ mode: 'edit', cat, val: String(budg) }) }
  function openDelete(cat: string) { setModal({ mode: 'delete', cat, val: '' }) }
  function closeModal() { setModal({ mode: null, cat: '', val: '' }) }

  async function confirmAdd() {
    const val = parseFloat(modal.val)
    if (!modal.cat || isNaN(val) || val <= 0) { showStatus('⚠ Enter category and amount'); return }
    setSaving(true)
    try {
      await api.updateBudgetEntry(modal.cat, val)
      dispatch({ type:'SET_BUDGET', payload: { ...budget, [modal.cat]: val } })
      showStatus('✓ Budget saved')
      closeModal()
    } catch (e) { showStatus('⚠ ' + (e instanceof Error ? e.message : 'Save failed')) }
    finally { setSaving(false) }
  }

  async function confirmEdit() {
    const val = parseFloat(modal.val)
    if (isNaN(val) || val <= 0) { closeModal(); return }
    setSaving(true)
    try {
      await api.updateBudgetEntry(modal.cat, val)
      dispatch({ type:'SET_BUDGET', payload: { ...budget, [modal.cat]: val } })
      showStatus('✓ Budget updated')
      closeModal()
    } catch (e) { showStatus('⚠ ' + (e instanceof Error ? e.message : 'Save failed')) }
    finally { setSaving(false) }
  }

  async function confirmDelete() {
    setSaving(true)
    try {
      await api.deleteBudgetEntry(modal.cat)
      const nb = { ...budget }
      delete nb[modal.cat]
      dispatch({ type:'SET_BUDGET', payload: nb })
      showStatus('✓ Budget removed')
      closeModal()
    } catch (e) { showStatus('⚠ ' + (e instanceof Error ? e.message : 'Delete failed')) }
    finally { setSaving(false) }
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
          <div className="lbl" style={{display:'flex',alignItems:'center',gap:6}}><Package size={16} /> Total Budget</div>
          <div style={{fontSize:14,fontWeight:700,color:totalOver?'var(--red)':'var(--green)'}}>{INR(totalSpent)} / {INR(totalBudget)}</div>
        </div>
        <div className="bar-bg" style={{height:8}}><div className="bar-f" style={{width:`${totalPct}%`,background:tCol}} /></div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:5,fontSize:11,color:'var(--muted)'}}>
          <span>{Math.round(totalPct)}% used · <span style={{color:ovCount?'var(--red)':'var(--green)',fontWeight:ovCount?700:400}}>{ovCount} overspent</span></span>
          <span>{totalOver?'🔴 Over '+INR(totalSpent-totalBudget):'✅ '+INR(totalBudget-totalSpent)+' left'}</span>
        </div>
      </div>

      {/* Search */}
      <div style={{position:'relative',marginBottom:8}}>
        <input
          className="form-inp"
          style={{paddingRight:32,fontSize:14}}
          placeholder="Search categories..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="icon-btn" style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)'}}
            onClick={() => setSearch('')}><XIcon size={14} /></button>
        )}
      </div>

      {/* Budget cards */}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {active.filter(([cat]) => cat.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>(cm[b[0]]||0)-(cm[a[0]]||0)).map(([cat, budg]) => {
          const spent = cm[cat] || 0
          const over = spent > budg
          const remaining = budg - spent
          const pct = Math.min(spent / budg * 100, 100)
          const col = over ? 'var(--rm)' : pct > 80 ? '#F59E0B' : 'var(--gm)'
          const badgeClass = over ? 'sbadge-red' : pct > 80 ? 'sbadge-amber' : 'sbadge-green'
          return (
            <div
              key={cat}
              className="card"
              style={{padding:'12px 12px',cursor:'pointer',display:'flex',flexDirection:'column',gap:6,transition:'all 0.15s ease'}}
              onClick={() => setCatSheet(cat)}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                <div style={{fontWeight:600,fontSize:14,color:'var(--text)',display:'flex',alignItems:'center'}}>
                  <CatIcon cat={cat} size={14} />{cat}
                </div>
                <div className={`sbadge ${badgeClass}`} style={{fontSize:'11px',padding:'4px 8px',flexShrink:0}}>
                  {over ? 'OVER' : pct > 80 ? 'NEAR' : 'OK'}
                </div>
                <div style={{display:'flex',gap:4,flexShrink:0}}>
                  <button className="icon-btn" onClick={(e) => {e.stopPropagation(); openEdit(cat, budg)}}><Pencil size={13} /></button>
                  <button className="icon-btn" style={{color:'var(--red)'}} onClick={(e) => {e.stopPropagation(); openDelete(cat)}}><Trash2 size={13} /></button>
                </div>
              </div>

              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:10}}>
                <div className="stat-block">
                  <div className="lbl">Budget</div>
                  <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{INR(budg)}</div>
                </div>
                <div className="stat-block" style={{textAlign:'right'}}>
                  <div className="lbl">Spent</div>
                  <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{INR(spent)}</div>
                </div>
              </div>

              <div style={{padding:'8px 10px',background:over?'rgba(239,68,68,.08)':pct>80?'rgba(245,158,11,.08)':'rgba(34,197,94,.08)',borderRadius:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div className="lbl">{over?'Over':'Left'}</div>
                <div style={{fontSize:14,fontWeight:700,color:col}}>{INR(Math.abs(remaining))}</div>
              </div>

              <div className="bar-bg" style={{height:5}}><div className="bar-f" style={{width:`${pct}%`,background:col}} /></div>
            </div>
          )
        })}
        {!active.length && <div className="lb">No budget categories. Click "+ Add".</div>}
        {active.length > 0 && !active.filter(([cat]) => cat.toLowerCase().includes(search.toLowerCase())).length && <div className="lb">No matching categories.</div>}
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
                <button className="modal-close" onClick={closeModal}><XIcon size={16} /></button>
              </div>
              <div className="modal-body">
                <div style={{fontSize:14,color:'var(--text)'}}>
                  Reset all budget amounts to default values? Your transactions will not be affected.
                </div>
              </div>
              <div className="modal-foot">
                <div className="modal-foot-l" />
                <button className="btn btn-sm" style={{background:'var(--border)',color:'var(--text)'}} onClick={closeModal}><XIcon size={13} />Cancel</button>
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
                <button className="modal-close" onClick={closeModal}><XIcon size={16} /></button>
              </div>
              <div className="modal-body">
                <div style={{fontSize:14,color:'var(--text)'}}>
                  Remove budget for <b style={{display:'flex',alignItems:'center',gap:4}}><CatIcon cat={modal.cat} size={13} />{modal.cat}</b>? This will not delete transactions.
                </div>
              </div>
              <div className="modal-foot">
                <div className="modal-foot-l" />
                <button className="btn btn-sm" style={{background:'var(--border)',color:'var(--text)'}} onClick={closeModal}><XIcon size={13} />Cancel</button>
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
                <button className="modal-close" onClick={closeModal}><XIcon size={16} /></button>
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
                  <div style={{fontSize:15,fontWeight:700,color:'var(--text)',display:'flex',alignItems:'center',gap:6}}>
                    <CatIcon cat={modal.cat} size={14} />{modal.cat}
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
                <button className="btn btn-sm" style={{background:'var(--border)',color:'var(--text)'}} onClick={closeModal}><XIcon size={13} />Cancel</button>
                <button className="btn btn-sm btn-green" onClick={modal.mode === 'add' ? confirmAdd : confirmEdit} disabled={saving}>
                  <Check size={13} />{saving ? '…' : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category Transaction Bottom Sheet */}
      {catSheet && (
        <div className={`modal-bg ${catSheet ? 'open' : ''}`} onClick={() => setCatSheet(null)} style={{position:'fixed',inset:0,zIndex:1000}}>
          <div className="sheet-panel" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle">
              <div className="sheet-handle-bar" />
            </div>

            <div className="sheet-hd">
              <h3 style={{fontSize:16,fontWeight:700,color:'var(--text)',margin:0,display:'flex',alignItems:'center',gap:6}}>
                <CatIcon cat={catSheet} size={15} />{catSheet}
              </h3>
              <div style={{display:'flex',gap:6}}>
                <button className="icon-btn" onClick={() => openEdit(catSheet, budget[catSheet] || 0)} title="Edit budget"><Pencil size={16} /></button>
                <button className="modal-close" onClick={() => setCatSheet(null)} style={{padding:0}}><XIcon size={20} /></button>
              </div>
            </div>

            <div className="sheet-stats" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
              <div className="card" style={{padding:'10px 12px'}}>
                <div className="lbl">Budget</div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginTop:4}}>{INR(budget[catSheet] || 0)}</div>
              </div>
              <div className="card" style={{padding:'10px 12px'}}>
                <div className="lbl">Spent</div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginTop:4}}>{INR(cm[catSheet] || 0)}</div>
              </div>
              <div className="card" style={{padding:'10px 12px',background:(cm[catSheet] || 0) > (budget[catSheet] || 0)?'rgba(239,68,68,.08)':'rgba(34,197,94,.08)'}}>
                <div className="lbl">{(cm[catSheet] || 0) > (budget[catSheet] || 0)?'Over':'Left'}</div>
                <div style={{fontSize:14,fontWeight:700,color:(cm[catSheet] || 0) > (budget[catSheet] || 0)?'var(--rm)':'var(--gm)',marginTop:4}}>
                  {INR(Math.abs((budget[catSheet] || 0) - (cm[catSheet] || 0)))}
                </div>
              </div>
            </div>

            <div className="sheet-body">
              {rows.filter(r => r.c === catSheet).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).length === 0 ? (
                <p style={{color:'var(--muted)',textAlign:'center',padding:'1rem 0',fontSize:14}}>No transactions in this category.</p>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {rows.filter(r => r.c === catSheet).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(txn => (
                    <div key={txn.id} className="card" style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',cursor:'pointer'}} onClick={() => {setCatSheet(null); onCategoryClick(catSheet)}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:13,color:'var(--text)'}}>{txn.desc}</div>
                        {txn.notes && <div style={{fontSize:11,color:'var(--muted)',marginTop:1}}>{txn.notes}</div>}
                        <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{txn.m}</div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontWeight:700,fontSize:14,color:'var(--rm)'}}>{INR(txn.a)}</div>
                        <div style={{fontSize:10,color:'var(--muted)',marginTop:1}}>{txn.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useCallback } from 'react'
import { Pencil, Trash2, Plus, RotateCcw } from 'lucide-react'
import { useStore } from '../store'
import { catMap, budgetSummary, INR, catIcon } from '../utils'
import { api } from '../api'
import { CATEGORIES } from '../constants'

interface Props { showStatus: (msg: string) => void; onCategoryClick: (cat: string) => void }

export default function Budget({ showStatus, onCategoryClick }: Props) {
  const { state, dispatch } = useStore()
  const { budget, rows } = state
  const cm = catMap(rows, budget)
  const { totalBudget, totalSpent, ovCount, totalOver, totalPct, tCol } = budgetSummary(budget, cm)
  const active = Object.entries(budget).filter(([,b]) => b > 0)
  const [editing, setEditing] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [adding, setAdding] = useState(false)
  const [newCat, setNewCat] = useState<string>(CATEGORIES[0])
  const [newAmt, setNewAmt] = useState('')
  const [saving, setSaving] = useState(false)

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

  async function saveEdit(cat: string) {
    const val = parseFloat(editVal)
    if (isNaN(val)) { setEditing(null); return }
    await saveBudget({ ...budget, [cat]: val })
    setEditing(null)
  }

  async function deleteCat(cat: string) {
    if (!confirm(`Remove budget for "${cat}"?`)) return
    const nb = { ...budget }
    delete nb[cat]
    await saveBudget(nb)
  }

  async function addCat() {
    const val = parseFloat(newAmt)
    if (!newCat || isNaN(val) || val <= 0) { showStatus('⚠ Enter category and amount'); return }
    await saveBudget({ ...budget, [newCat]: val })
    setNewAmt(''); setAdding(false)
  }

  return (
    <div className="pg">
      <div className="sec" style={{marginTop:12}}>
        <span className="sec-h">Budget Management</span>
        <div style={{display:'flex',gap:6}}>
          <button className="btn btn-sm btn-green" onClick={() => setAdding(a=>!a)}><Plus size={14} />Add</button>
          <button className="btn btn-sm" style={{background:'var(--border)',color:'var(--text)'}} disabled={saving} onClick={async () => {
            if (!confirm('Reset all budgets to defaults?')) return
            setSaving(true)
            try {
              const def = await api.resetBudget()
              dispatch({ type:'SET_BUDGET', payload: def })
              showStatus('✓ Budget reset to defaults')
            } catch (e) {
              showStatus('⚠ ' + (e instanceof Error ? e.message : 'Reset failed'))
            } finally { setSaving(false) }
          }}><RotateCcw size={13} />Reset</button>
        </div>
      </div>

      {adding && (
        <div className="card cp" style={{marginBottom:10}}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end'}}>
            <select className="form-sel" style={{flex:2,minWidth:140}} value={newCat} onChange={e=>setNewCat(e.target.value)}>
              {CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select>
            <input className="form-inp mono" type="number" placeholder="Budget ₹" style={{flex:1,minWidth:100}} value={newAmt} onChange={e=>setNewAmt(e.target.value)} />
            <button className="btn btn-sm btn-green" onClick={addCat} disabled={saving}>{saving?'…':'Add'}</button>
          </div>
        </div>
      )}

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
                  {editing === cat ? (
                    <input
                      className="form-inp mono" type="number" style={{width:90,padding:'2px 7px',fontSize:12}}
                      value={editVal} autoFocus
                      onChange={e=>setEditVal(e.target.value)}
                      onBlur={()=>saveEdit(cat)}
                      onKeyDown={e=>{if(e.key==='Enter')saveEdit(cat);if(e.key==='Escape')setEditing(null)}}
                    />
                  ) : (
                    <span className="bamt mono" onClick={()=>{setEditing(cat);setEditVal(String(budg))}}>{INR(budg)}</span>
                  )}
                </div>
              </div>
              <div className="bud-actions">
                <button className="icon-btn" onClick={()=>{setEditing(cat);setEditVal(String(budg))}}><Pencil size={14} /></button>
                <button className="icon-btn" style={{color:'var(--red)'}} onClick={()=>deleteCat(cat)}><Trash2 size={14} /></button>
              </div>
            </div>
          )
        })}
        {!active.length && <div className="lb">No budget categories. Click "+ Add Category".</div>}
      </div>
    </div>
  )
}

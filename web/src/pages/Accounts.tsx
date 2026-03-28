import { useState } from 'react'
import { useStore } from '../store'
import { acctFlows, INR } from '../utils'
import { ACCOUNTS, CC_MODES } from '../constants'
import { api } from '../api'
import CatIcon from '../components/CatIcon'
import { Wallet } from 'lucide-react'

interface Props { showStatus: (msg: string) => void }

export default function Accounts({ showStatus }: Props) {
  const { state, dispatch } = useStore()
  const { rows, openingBal } = state
  const flows = acctFlows(rows, openingBal)
  const [editBal, setEditBal] = useState<string|null>(null)
  const [editVal, setEditVal] = useState('')

  async function saveOpeningBal(acc: string) {
    const val = parseFloat(editVal)
    if (isNaN(val)) { setEditBal(null); return }
    const newBal = { ...openingBal, [acc]: val }
    try {
      await api.saveOpeningBal(newBal)
      dispatch({ type:'SET_OPENING_BAL', payload: newBal })
      showStatus('✓ Balance saved')
    } catch (e) { showStatus('⚠ ' + (e instanceof Error ? e.message : 'Save failed')) }
    setEditBal(null)
  }

  const ccCatMap: Record<string,{ICICI:number;HDFC:number}> = {}
  rows.filter(r => (CC_MODES as readonly string[]).includes(r.m)).forEach(r => {
    if (!ccCatMap[r.c]) ccCatMap[r.c] = { ICICI:0, HDFC:0 }
    if (r.m === 'ICICI') ccCatMap[r.c].ICICI += r.a
    else ccCatMap[r.c].HDFC += r.a
  })
  const ccRows = Object.entries(ccCatMap).sort((a,b)=>(b[1].ICICI+b[1].HDFC)-(a[1].ICICI+a[1].HDFC))
  const icTotal = ccRows.reduce((s,[,v])=>s+v.ICICI,0)
  const hdTotal = ccRows.reduce((s,[,v])=>s+v.HDFC,0)

  return (
    <div className="pg">
      <div className="sec" style={{marginTop:12}}>
        <span className="sec-h" style={{display:'flex',alignItems:'center',gap:6}}><Wallet size={18} /> Account Balances</span>
        <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>Tap opening balance to edit</div>
      </div>

      <div className="acct-g2" style={{marginBottom:14}}>
        {ACCOUNTS.map((acc, i) => {
          const { inflow, outflow, current } = flows[acc] || { inflow:0, outflow:0, current:0 }
          const net = inflow - outflow
          const curCol = current>=0 ? 'var(--green)' : 'var(--red)'
          const borderColors = ['var(--gm)','var(--navy)','var(--amber)']
          return (
            <div key={acc} className="acct-card" style={{borderTopColor: borderColors[i]}}>
              <div className="acct-name">{acc}</div>
              <div className="acct-rows">
                <div className="acct-row">
                  <span className="acct-row-lbl">Opening</span>
                  {editBal===acc ? (
                    <input className="form-inp" type="number" style={{width:80,padding:'2px 6px',fontSize:12}} value={editVal} autoFocus
                      onChange={e=>setEditVal(e.target.value)}
                      onBlur={()=>saveOpeningBal(acc)}
                      onKeyDown={e=>{if(e.key==='Enter')saveOpeningBal(acc);if(e.key==='Escape')setEditBal(null)}} />
                  ) : (
                    <span className="acct-row-val bamt" onClick={()=>{setEditBal(acc);setEditVal(String(openingBal[acc]||0))}}>{INR(openingBal[acc]||0)}</span>
                  )}
                </div>
                <div className="acct-row">
                  <span className="acct-row-lbl">↑ In</span>
                  <span className="acct-row-val" style={{color:'var(--green)'}}>+{INR(inflow)}</span>
                </div>
                <div className="acct-row">
                  <span className="acct-row-lbl">↓ Out</span>
                  <span className="acct-row-val" style={{color:'var(--red)'}}>−{INR(outflow)}</span>
                </div>
                <div className="acct-row">
                  <span className="acct-row-lbl">Net</span>
                  <span className="acct-row-val" style={{color:net>=0?'var(--green)':'var(--red)'}}>{net>=0?'+':'−'}{INR(Math.abs(net))}</span>
                </div>
              </div>
              <div className="acct-balance">
                <span className="acct-balance-lbl">Balance</span>
                <span className="acct-balance-val" style={{color:curCol}}>{current<0?'−':''}{INR(Math.abs(current))}</span>
              </div>
            </div>
          )
        })}
      </div>

      {ccRows.length > 0 && (
        <>
          <div className="sec"><div className="sec-h" style={{display:'flex',alignItems:'center',gap:6}}><Wallet size={16} /> CC Spending by Category</div></div>

          {/* Mobile cards */}
          <div className="txn-cards" style={{marginBottom:14}}>
            {ccRows.map(([cat,v]) => (
              <div key={cat} className="txn-card">
                <div className="txn-card-top">
                  <span className="txn-card-desc" style={{display:'flex',alignItems:'center',gap:6}}><CatIcon cat={cat} size={14} />{cat}</span>
                  <span className="txn-card-amt" style={{fontSize:14,fontWeight:700,color:'var(--red)'}}>{INR(v.ICICI+v.HDFC)}</span>
                </div>
                <div className="txn-card-bot">
                  {v.ICICI > 0 && <span style={{fontSize:11,color:'#2563EB'}}>ICICI {INR(v.ICICI)}</span>}
                  {v.HDFC  > 0 && <span style={{fontSize:11,color:'var(--navy)'}}>HDFC {INR(v.HDFC)}</span>}
                </div>
              </div>
            ))}
            <div className="txn-card" style={{background:'var(--navy-lt)'}}>
              <div className="txn-card-top">
                <span className="txn-card-desc" style={{fontWeight:700}}>Total</span>
                <span className="txn-card-amt" style={{fontSize:14,fontWeight:700,color:'var(--red)'}}>{INR(icTotal+hdTotal)}</span>
              </div>
              <div className="txn-card-bot">
                <span style={{fontSize:11,color:'#2563EB'}}>ICICI {INR(icTotal)}</span>
                <span style={{fontSize:11,color:'var(--navy)'}}>HDFC {INR(hdTotal)}</span>
              </div>
            </div>
          </div>

          {/* Desktop table */}
          <div className="tw txn-table" style={{marginBottom:14}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr>
                <th style={{textAlign:'left',padding:'8px 12px',fontSize:11,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>Category</th>
                <th style={{textAlign:'right',padding:'8px 12px',fontSize:11,fontWeight:600,color:'#2563EB',textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>ICICI</th>
                <th style={{textAlign:'right',padding:'8px 12px',fontSize:11,fontWeight:600,color:'var(--navy)',textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>HDFC</th>
                <th style={{textAlign:'right',padding:'8px 12px',fontSize:11,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>Total</th>
              </tr></thead>
              <tbody>
                {ccRows.map(([cat,v])=>(
                  <tr key={cat}>
                    <td style={{padding:'9px 12px',borderBottom:'1px solid var(--border)'}}><span className="badge ba" style={{fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:6,padding:'6px 10px'}}><CatIcon cat={cat} size={13} />{cat}</span></td>
                    <td style={{textAlign:'right',padding:'9px 12px',borderBottom:'1px solid var(--border)',fontSize:14,fontWeight:700,color:v.ICICI?'#2563EB':'var(--muted)'}}>{v.ICICI?INR(v.ICICI):'—'}</td>
                    <td style={{textAlign:'right',padding:'9px 12px',borderBottom:'1px solid var(--border)',fontSize:14,fontWeight:700,color:v.HDFC?'var(--navy)':'var(--muted)'}}>{v.HDFC?INR(v.HDFC):'—'}</td>
                    <td style={{textAlign:'right',padding:'9px 12px',borderBottom:'1px solid var(--border)',fontSize:14,fontWeight:700,color:'var(--red)'}}>{INR(v.ICICI+v.HDFC)}</td>
                  </tr>
                ))}
                <tr style={{background:'#F8FAFC'}}>
                  <td style={{padding:'9px 12px',fontWeight:700}}>Total</td>
                  <td style={{textAlign:'right',padding:'9px 12px',fontSize:14,fontWeight:700,color:'#2563EB'}}>{INR(icTotal)}</td>
                  <td style={{textAlign:'right',padding:'9px 12px',fontSize:14,fontWeight:700,color:'var(--navy)'}}>{INR(hdTotal)}</td>
                  <td style={{textAlign:'right',padding:'9px 12px',fontSize:14,fontWeight:700,color:'var(--red)'}}>{INR(icTotal+hdTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

    </div>
  )
}

import { useStore } from '../store'
import { INR, fd } from '../utils'
import { CC_MODES, OTHER_CR, ALL_CR, CR_COLORS, MNS, ACCOUNTS } from '../constants'
import CatIcon from '../components/CatIcon'
import { CreditCard, Users, List } from 'lucide-react'

const CC_CYCLE_DAY = 19 // billing cycle: 19th → 18th next month

function cycleLabel(month: string, year: string): string {
  const mi = MNS.indexOf(month as typeof MNS[number])
  const prevMi = mi === 0 ? 11 : mi - 1
  return `${CC_CYCLE_DAY} ${MNS[prevMi]} – ${CC_CYCLE_DAY - 1} ${month} ${year}`
}

export default function Credits() {
  const { state } = useStore()
  const { rows, month, year } = state

  // Totals per credit source — all transactions add to outstanding (spending + cash advances)
  const totals: Record<string, number> = {}
  ;[...CC_MODES, ...OTHER_CR].forEach(m => totals[m] = 0)
  rows.forEach(r => {
    if ((ALL_CR as readonly string[]).includes(r.m)) {
      totals[r.m] += r.a
    }
  })

  const ccNet      = CC_MODES.reduce((s, m) => s + totals[m], 0)
  const otherTotal = OTHER_CR.reduce((s, m) => s + totals[m], 0)
  const overall    = ccNet + otherTotal

  const cr = rows.filter(r => (ALL_CR as readonly string[]).includes(r.m))
  const ccPaymentRows = rows.filter(r =>
    r.t === 'Transfer' && CC_MODES.some(cc => r.notes?.startsWith('→' + cc))
  )

  return (
    <div className="pg">
      <div className="sec" style={{ marginTop: 12 }}>
        <span className="sec-h">Credit Summary</span>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{cycleLabel(month, year)}</div>
      </div>

      {/* 3-card summary */}
      <div className="cr-g3">
        <div className="card cp" style={{ borderTop: '3px solid var(--red)' }}>
          <div className="cc-n">Overall Total</div>
          <div className="cc-a" style={{ fontSize: 16, fontWeight: 700, color: 'var(--red)' }}>{INR(overall)}</div>
          <div className="cc-d">All credit accounts</div>
        </div>
        <div className="card cp" style={{ borderTop: '3px solid #2563EB' }}>
          <div className="cc-n">CC Outstanding</div>
          <div className="cc-a" style={{ fontSize: 16, fontWeight: 700, color: '#2563EB' }}>{INR(ccNet)}</div>
          <div className="cc-d">ICICI + HDFC</div>
        </div>
        <div className="card cp" style={{ borderTop: '3px solid #0891B2' }}>
          <div className="cc-n">Other Credits</div>
          <div className="cc-a" style={{ fontSize: 16, fontWeight: 700, color: '#0891B2' }}>{INR(otherTotal)}</div>
          <div className="cc-d">Bommi + Ramya + Others</div>
        </div>
      </div>

      {/* CC cards */}
      <div className="sec"><div className="sec-h" style={{display:'flex',alignItems:'center',gap:6}}><CreditCard size={16} /> Credit Cards</div></div>
      <div className="cc-g" style={{ marginBottom: 14 }}>
        {CC_MODES.map(m => (
          <div key={m} className="card cp" style={{ borderTop: `3px solid ${CR_COLORS[m]}` }}>
            <div className="cc-n">{m}</div>
            <div className="cc-a" style={{ fontSize: 16, fontWeight: 700, color: CR_COLORS[m] }}>{INR(totals[m])}</div>
            <div className="cc-d">{totals[m] ? 'This cycle' : 'No transactions'}</div>
          </div>
        ))}
      </div>

      {/* Other credit cards */}
      <div className="sec"><div className="sec-h" style={{display:'flex',alignItems:'center',gap:6}}><Users size={16} /> Other Credits</div></div>
      <div className="cr-g3" style={{ marginBottom: 14 }}>
        {OTHER_CR.map(m => (
          <div key={m} className="card cp" style={{ borderTop: `3px solid ${CR_COLORS[m]}` }}>
            <div className="cc-n">{m}</div>
            <div className="cc-a" style={{ fontSize: 16, fontWeight: 700, color: CR_COLORS[m] }}>{INR(Math.max(0, totals[m]))}</div>
            <div className="cc-d">{totals[m] ? 'This cycle' : 'No transactions'}</div>
          </div>
        ))}
      </div>

      {/* Transactions */}
      <div className="sec"><div className="sec-h" style={{display:'flex',alignItems:'center',gap:6}}><List size={16} /> Transactions This Cycle</div></div>

      {cr.length === 0 && ccPaymentRows.length === 0 ? (
        <div className="lb">No credit transactions this cycle</div>
      ) : (
        <>
          <div className="txn-cards">
            {cr.map(r => {
              const isAdv = r.t === 'Transfer' && (ACCOUNTS as readonly string[]).some(a => r.notes?.startsWith('→' + a))
              const toAcct = isAdv ? r.notes?.match(/^→(\S+)/)?.[1] || '' : ''
              return (
                <div key={r.id} className="txn-card">
                  <div className="txn-card-top">
                    <span className="txn-card-desc">{r.desc}</span>
                    <span className="txn-card-amt" style={{fontSize:14,fontWeight:700,color: isAdv ? 'var(--amber)' : 'var(--red)'}}>{isAdv ? '⇄' : '−'}{INR(r.a)}</span>
                  </div>
                  <div className="txn-card-bot">
                    <span className="txn-card-date">{fd(r.date)}</span>
                    <span className="badge bn" style={{fontSize:10,borderColor:CR_COLORS[r.m],color:CR_COLORS[r.m]}}>{r.m}</span>
                    {isAdv
                      ? <span className="badge bp" style={{fontSize:10}}>Advance → {toAcct}</span>
                      : <span className="badge ba" style={{fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:6,padding:'6px 10px'}}><CatIcon cat={r.c} size={13} />{r.c}</span>
                    }
                  </div>
                </div>
              )
            })}
            {ccPaymentRows.map(r => {
              const cc = CC_MODES.find(c => r.notes?.startsWith('→' + c)) || ''
              return (
                <div key={r.id} className="txn-card">
                  <div className="txn-card-top">
                    <span className="txn-card-desc">{r.desc}</span>
                    <span className="txn-card-amt" style={{fontSize:14,fontWeight:700,color:'var(--green)'}}>+{INR(r.a)}</span>
                  </div>
                  <div className="txn-card-bot">
                    <span className="txn-card-date">{fd(r.date)}</span>
                    <span className="badge bn" style={{fontSize:10,borderColor:CR_COLORS[cc],color:CR_COLORS[cc]}}>{cc}</span>
                    <span className="badge bg" style={{fontSize:10}}>Payment</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="tw txn-table">
            <table>
              <thead><tr>
                <th>Date</th><th>Description</th><th>Account</th><th>Category</th><th className="ta-r">Amount</th>
              </tr></thead>
              <tbody>
                {cr.map(r => {
                  const isAdv = r.t === 'Transfer' && (ACCOUNTS as readonly string[]).some(a => r.notes?.startsWith('→' + a))
                  const toAcct = isAdv ? r.notes?.match(/^→(\S+)/)?.[1] || '' : ''
                  return (
                    <tr key={r.id}>
                      <td>{fd(r.date)}</td>
                      <td>{r.desc}</td>
                      <td><span className="badge bn" style={{borderColor:CR_COLORS[r.m],color:CR_COLORS[r.m]}}>{r.m}</span></td>
                      <td>{isAdv ? <span className="badge bp" style={{fontSize:10}}>Advance → {toAcct}</span> : <span className="badge ba" style={{fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:6,padding:'6px 10px'}}><CatIcon cat={r.c} size={13} />{r.c}</span>}</td>
                      <td style={{textAlign:'right',fontSize:14,fontWeight:700,color: isAdv ? 'var(--amber)' : 'var(--red)'}}>{isAdv ? '⇄' : '−'}{INR(r.a)}</td>
                    </tr>
                  )
                })}
                {ccPaymentRows.map(r => {
                  const cc = CC_MODES.find(c => r.notes?.startsWith('→' + c)) || ''
                  return (
                    <tr key={r.id}>
                      <td>{fd(r.date)}</td>
                      <td>{r.desc}</td>
                      <td><span className="badge bn" style={{borderColor:CR_COLORS[cc],color:CR_COLORS[cc]}}>{cc}</span></td>
                      <td><span className="badge bg" style={{fontSize:10}}>Payment</span></td>
                      <td style={{textAlign:'right',fontSize:14,fontWeight:700,color:'var(--green)'}}>+{INR(r.a)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

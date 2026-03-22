import { useStore, usePage } from '../store'
import { Transaction } from '../types'
import { fd, INR, catIcon } from '../utils'
import { ALL_CR } from '../constants'
import { TXN_PAGE } from '../constants'

const FILTERS = ['All','Expense','Income','Transfer','Savings','ICICI','HDFC','Bommi','Ramya']

interface Props { onEdit: (r: Transaction) => void; onAddClick: () => void }

function typeBadge(t: string) {
  const cls = t==='Income'?'bg':t==='Savings'?'ba':t==='Transfer'?'bp':'br'
  return <span className={`badge ${cls}`}>{t}</span>
}

export default function Transactions({ onEdit, onAddClick }: Props) {
  const { state, dispatch } = useStore()
  const { rows, total, shown } = usePage()
  const rem = total - shown

  return (
    <div className="pg">
      <div className="sec" style={{marginTop:12}}>
        <span className="sec-h">{total} entries · {state.month} {state.year}</span>
        <button className="btn btn-sm btn-green" onClick={onAddClick}>＋ Add</button>
      </div>

      <div className="pills">
        {FILTERS.map(f => (
          <button key={f} className={`pill ${state.filter===f?'active':''}`}
            onClick={() => dispatch({ type:'SET_FILTER', payload:f })}>
            {f}
          </button>
        ))}
      </div>

      {state.loading ? (
        <div className="lb"><div className="spin" style={{display:'inline-block',marginRight:8}} />Loading…</div>
      ) : rows.length === 0 ? (
        <div className="lb">No entries</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="txn-cards">
            {rows.map(r => {
              const isI = r.t==='Income', isS=r.t==='Savings'
              const col = isI?'var(--green)':isS?'var(--amber)':'var(--red)'
              const isCr = (ALL_CR as readonly string[]).includes(r.m)
              return (
                <div key={r.id} className="txn-card" onClick={() => onEdit(r)}>
                  <div className="txn-card-top">
                    <span className="txn-card-desc">{r.desc}</span>
                    <span className="txn-card-amt mono" style={{color:col}}>{(isI||isS)?'+':'−'}{INR(r.a)}</span>
                  </div>
                  <div className="txn-card-bot">
                    <span className="txn-card-date">{fd(r.date)}</span>
                    <span className="badge ba" style={{fontSize:10}}>{catIcon(r.c)}{r.c}</span>
                    {typeBadge(r.t)}
                    {isCr ? <span className="badge bn" style={{fontSize:10}}>{r.m}</span> : <span style={{fontSize:11,color:'var(--muted)'}}>{r.m}</span>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="tw txn-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Description</th><th>Category</th>
                  <th>Type</th><th>Mode</th><th className="ta-r">Amount</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const isI = r.t==='Income', isS=r.t==='Savings'
                  const col = isI?'var(--green)':isS?'var(--amber)':'var(--red)'
                  const isCr = (ALL_CR as readonly string[]).includes(r.m)
                  return (
                    <tr key={r.id}>
                      <td>{fd(r.date)}</td>
                      <td>{r.desc}</td>
                      <td><span className="badge ba" style={{fontSize:10}}>{catIcon(r.c)}{r.c}</span></td>
                      <td>{typeBadge(r.t)}</td>
                      <td>{isCr?<span className="badge bn">{r.m}</span>:r.m}</td>
                      <td className="mono ta-r" style={{color:col}}>{(isI||isS)?'+':'−'}{INR(r.a)}</td>
                      <td><button className="icon-btn" onClick={()=>onEdit(r)}>✏️</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {rem > 0 && (
        <button className="btn" style={{width:'100%',marginTop:10,background:'var(--navy-lt)',color:'var(--navy)'}}
          onClick={() => dispatch({ type:'SET_TXN_PAGE', payload: state.txnPage+1 })}>
          + Show {Math.min(rem, TXN_PAGE)} more ({rem} remaining)
        </button>
      )}
    </div>
  )
}

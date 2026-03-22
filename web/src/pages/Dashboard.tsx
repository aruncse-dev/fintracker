import { useStore } from '../store'
import { sumType, sumCC, sumOtherCr, catMap, budgetSummary, acctFlows, INR } from '../utils'
import { ACCOUNTS } from '../constants'

function svgDonut(data: {label:string;v:number;col:string}[], size: number) {
  const total = data.reduce((s,d)=>s+d.v,0)
  if (!total) return null
  const r = size/2 - 8, cx = size/2, cy = size/2
  let offset = 0
  const circ = 2*Math.PI*r
  const paths = data.map(d => {
    const pct = d.v/total
    const dash = pct * circ
    const el = <circle key={d.label} cx={cx} cy={cy} r={r} fill="none" stroke={d.col} strokeWidth={14} strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={-offset * circ} />
    offset += pct
    return el
  })
  return <svg width={size} height={size} style={{transform:'rotate(-90deg)',flexShrink:0}}>{paths}</svg>
}

interface Props { onAddClick: () => void }

export default function Dashboard({ onAddClick }: Props) {
  const { state } = useStore()
  const { rows, budget, openingBal, month, year } = state

  if (state.loading) return <div className="pg"><div className="lb"><div className="spin" /><span>Loading…</span></div></div>

  const inc = sumType(rows, 'Income')
  const exp = sumType(rows, 'Expense')
  const cc  = sumCC(rows)
  const ocr = sumOtherCr(rows)
  const flows = acctFlows(rows, openingBal)
  const totalSavings = ACCOUNTS.reduce((s,a) => s + (flows[a]?.current||0), 0)
  const monthNet = inc - exp
  const surplus = inc - exp
  const cm = catMap(rows, budget)
  const { totalBudget, totalSpent, ovCount, totalOver, totalPct, tCol } = budgetSummary(budget, cm)

  const overspent = Object.entries(budget)
    .filter(([c,b]) => b>0 && (cm[c]||0)>b)
    .map(([c,b]) => ({ c, b, s: cm[c]||0 }))
    .sort((a,b) => (b.s-b.b)-(a.s-a.b))

  const cashBankExp = rows.filter(r => (ACCOUNTS as readonly string[]).includes(r.m) && r.t==='Expense').reduce((s,r)=>s+r.a,0)
  const spendData = [
    {label:'Credit Cards', v:cc,  col:'#7C3AED'},
    {label:'Other Credits',v:ocr, col:'#0891B2'},
    {label:'Cash / Bank',  v:cashBankExp, col:'#22C55E'},
  ].filter(d=>d.v>0)
  const incExpData = [
    {label:'Income', v:inc, col:'#22C55E'},
    {label:'Expense',v:exp, col:'#EF4444'},
  ].filter(d=>d.v>0)

  return (
    <div className="pg">
      <div className="sec" style={{marginTop:12}}>
        <span className="sec-h">{month} {year}</span>
        <button className="btn btn-sm btn-green" onClick={onAddClick}>＋ Add Transaction</button>
      </div>

      {!rows.length && (
        <div className="alert a-warn">⚠ No transactions yet. Tap + to add your first entry.</div>
      )}

      {/* KPIs */}
      <div className="kpis" style={{marginTop:12}}>
        <div className="kpi"><div className="kpi-l">Income</div><div className="kpi-v mono" style={{color:'var(--green)'}}>+{INR(inc)}</div></div>
        <div className="kpi"><div className="kpi-l">Expenses</div><div className="kpi-v mono" style={{color:'var(--red)'}}>−{INR(exp)}</div></div>
        <div className="kpi"><div className="kpi-l">Credit Cards</div><div className="kpi-v mono" style={{color:'#7C3AED'}}>−{INR(cc)}</div></div>
        <div className="kpi"><div className="kpi-l">Other Credits</div><div className="kpi-v mono" style={{color:'#0891B2'}}>−{INR(ocr)}</div></div>
      </div>

      {/* Balance hero */}
      <div className="hero">
        <div className="hero-l">Total Savings Balance</div>
        <div className="hero-a mono" style={{color: totalSavings>=0?'var(--green)':'var(--red)'}}>
          {totalSavings<0?'−':''}{INR(Math.abs(totalSavings))}
        </div>
        <div className="hero-s">
          This month: {monthNet>=0?'+':'−'}{INR(Math.abs(monthNet))} · Opening: {INR(ACCOUNTS.reduce((s,a)=>s+(openingBal[a]||0),0))}
        </div>
      </div>

      {/* Surplus */}
      {surplus > 0 && (
        <div className="card cp" style={{borderLeft:'4px solid var(--gm)',marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>💡 Month Surplus</div>
          <div className="mono" style={{fontSize:20,fontWeight:700,color:'var(--green)'}}>+{INR(surplus)}</div>
          <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>Income − Expenses</div>
        </div>
      )}

      {/* Budget summary card */}
      {Object.keys(budget).length > 0 && (
        <div className="card cp" style={{marginBottom:12,borderLeft:`4px solid ${tCol}`,cursor:'pointer'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
            <span style={{fontSize:12,fontWeight:700}}>📦 Total Budget</span>
            <span className="mono" style={{fontSize:12,fontWeight:700,color:totalOver?'var(--red)':'var(--green)'}}>{INR(totalSpent)} / {INR(totalBudget)}</span>
          </div>
          <div className="bar-bg" style={{height:8}}><div className="bar-f" style={{width:`${totalPct}%`,background:tCol}} /></div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:5,fontSize:11,color:'var(--muted)'}}>
            <span>{Math.round(totalPct)}% used · <span style={{color:ovCount?'var(--red)':'var(--green)',fontWeight:ovCount?700:400}}>{ovCount} overspent</span></span>
            <span>{totalOver ? '🔴 Over '+INR(totalSpent-totalBudget) : '✅ '+INR(totalBudget-totalSpent)+' left'}</span>
          </div>
          {overspent.length > 0 && (
            <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${totalOver?'#FECACA':'var(--border)'}`}}>
              <div style={{fontSize:10,fontWeight:700,color:'var(--red)',textTransform:'uppercase',letterSpacing:.5,marginBottom:5}}>🚨 Overspent</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {overspent.map(x=>(
                  <span key={x.c} style={{background:'var(--red)',color:'#fff',borderRadius:20,padding:'3px 9px',fontSize:11,fontWeight:600}}>{x.c} −{INR(x.s-x.b)}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      {(inc > 0 || exp > 0) && (
        <div className="chart-grid">
          <div className="card cp">
            <div style={{fontSize:11,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>Spend by Source</div>
            <div className="chart-wrap">
              {svgDonut(spendData, 96)}
              <div className="chart-legend">
                {spendData.map(d => (
                  <div key={d.label} className="chart-legend-row">
                    <div className="chart-dot" style={{background:d.col}} />
                    <span className="chart-lbl">{d.label}</span>
                    <span className="chart-val">{Math.round(d.v/spendData.reduce((s,x)=>s+x.v,0)*100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card cp">
            <div style={{fontSize:11,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>Income vs Expense</div>
            <div className="chart-wrap">
              {svgDonut(incExpData, 96)}
              <div className="chart-legend">
                {incExpData.map(d => (
                  <div key={d.label} className="chart-legend-row">
                    <div className="chart-dot" style={{background:d.col}} />
                    <span className="chart-lbl">{d.label}</span>
                    <span className="chart-val">{INR(d.v)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

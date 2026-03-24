import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { MNS } from '../constants'
import { catMap, sumType, budgetSummary, INR } from '../utils'
import { api } from '../api'

interface Msg { role: 'u' | 'a'; text: string }

interface Props { open: boolean; onClose: () => void; onSaved: () => void }

function todayStr() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}-${MNS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`
}

export default function AIPanel({ open, onClose, onSaved }: Props) {
  const { state } = useStore()
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'a', text: '👋 Hi! I can:<br/>• <b>Add transactions</b> — type <b>500 vegetables</b> or <b>5000 salary</b><br/>• <b>Analyse expenses</b> — ask <b>where am I overspending?</b> or <b>how are my savings?</b>' }
  ])
  const [inp, setInp] = useState('')
  const [busy, setBusy] = useState(false)
  const msgsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [msgs])

  async function send() {
    const text = inp.trim()
    if (!text || busy) return
    setInp('')
    setMsgs(m => [...m, { role: 'u', text }])
    setBusy(true)

    const cm = catMap(state.rows, state.budget)
    const { totalBudget, totalSpent, ovCount } = budgetSummary(state.budget, cm)
    const ctx = {
      month: state.month + ' ' + state.year,
      inc: Math.round(sumType(state.rows, 'Income')),
      exp: Math.round(sumType(state.rows, 'Expense')),
      topCats: Object.entries(cm).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([c,v])=>({c,v:Math.round(v)})),
      overspent: Object.entries(state.budget).filter(([c,b])=>b>0&&(cm[c]||0)>b).map(([c,b])=>({c,over:Math.round((cm[c]||0)-b)})),
      totalBudget, totalSpent, ovCount,
    }
    const system = [
      'You are a concise personal finance assistant for a family in India.',
      'Monthly income: ₹2,38,000. Fixed commitments: Loan EMI ₹56,000, Jewel Loan ₹30,000, Insurance ₹9,700, SIP ₹11,500, Rent ₹5,500, Vijaya Amma ₹6,500, Staff Salary ₹18,000.',
      `Current month (${ctx.month}): Income ₹${ctx.inc}, Expenses ₹${ctx.exp}.`,
      `Top spending: ${JSON.stringify(ctx.topCats)}.`,
      `Budget vs actual (overspent): ${JSON.stringify(ctx.overspent)}.`,
      'When user describes a transaction (amount + item), call the add_transaction tool with the right category.',
      'For spending analysis, budget questions, or advice — reply in plain text under 150 words with specific numbers. Be direct and actionable.',
    ].join(' ')

    try {
      const reply = await api.gemini(system, text)
      try {
        const j = JSON.parse(reply)
        if (j.__tool === 'add_transaction') {
          await api.addRow({
            month: state.month, year: state.year,
            date: todayStr(),
            desc: j.desc,
            a: j.amt,
            c: j.cat,
            t: j.type,
            m: j.mode || 'Cash',
            notes: ''
          })
          setMsgs(m => [...m, { role: 'a', text: `✅ Added <b>${INR(j.amt)}</b> → ${j.cat} <span style="opacity:.7;font-size:11px">(${j.type} · ${j.mode || 'Cash'} · ${todayStr()})</span>` }])
          onSaved()
          return
        }
      } catch {}
      setMsgs(m => [...m, { role: 'a', text: reply }])
    } catch (e) {
      setMsgs(m => [...m, { role: 'a', text: '⚠ ' + (e instanceof Error ? e.message : 'Error') }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`ai-panel ${open ? 'open' : ''}`}>
      <div className="ai-hd">
        <span style={{ color: '#A5B4FC', fontWeight: 700, fontSize: 14 }}>🤖 AI Assistant</span>
        <button onClick={onClose} className="modal-close">✕</button>
      </div>
      <div className="ai-msgs" ref={msgsRef}>
        {msgs.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`} dangerouslySetInnerHTML={{ __html: m.text }} />
        ))}
        {busy && <div className="ai-msg a">…</div>}
      </div>
      <div className="ai-foot">
        <input
          className="ai-inp" value={inp}
          onChange={e => setInp(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="e.g. 500 vegetables or 5000 salary…"
        />
        <button className="btn btn-sm" onClick={send} disabled={busy}>Send</button>
      </div>
    </div>
  )
}

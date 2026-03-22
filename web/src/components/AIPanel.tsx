import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { CATEGORIES, INCOME_CATS, ALL_MODES } from '../constants'
import { catMap, sumType, budgetSummary } from '../utils'

const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY as string
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`

async function callGemini(system: string, userText: string): Promise<string> {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
    }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

interface Msg { role: 'u' | 'a'; text: string }

interface Props { open: boolean; onClose: () => void }

export default function AIPanel({ open, onClose }: Props) {
  const { state } = useStore()
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'a', text: '👋 Hi! Ask me about your finances or type a transaction like "500 vegetables"' }
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
      `Valid expense categories: ${CATEGORIES.join(', ')}. Income categories: ${INCOME_CATS.join(', ')}. Valid modes: ${ALL_MODES.join(', ')}.`,
      'If user input looks like a transaction (has an amount + any hint of category/description), ALWAYS return ONLY raw JSON with no markdown: {"entry":{"amt":N,"desc":"...","cat":"<exact category name>","type":"Expense or Income","mode":"Cash"}}. Otherwise reply in plain text under 120 words.',
    ].join(' ')

    try {
      const reply = await callGemini(system, text)
      try {
        const j = JSON.parse(reply)
        if (j.entry) {
          setMsgs(m => [...m, { role: 'a', text: `Got it! ₹${j.entry.amt} → ${j.entry.cat}. Open the + button to add it.` }])
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
          placeholder="Ask anything or type a transaction…"
        />
        <button className="btn btn-sm" onClick={send} disabled={busy}>Send</button>
      </div>
    </div>
  )
}

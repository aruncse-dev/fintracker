import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { MNS, ACCOUNTS, CC_MODES, OTHER_CR, CATEGORIES, INCOME_CATS, ALL_MODES } from '../constants'
import { catMap, sumType, budgetSummary, acctFlows, INR } from '../utils'
import { api } from '../api'

interface Msg { role: 'u' | 'a'; text: string }

interface Props { open: boolean; onClose: () => void; onSaved: () => void }

function parseDirectCommand(raw: string) {
  if (!/^add_transaction\s*\(/i.test(raw.trim())) return null
  const params: Record<string, string> = {}
  for (const [, k, v] of raw.matchAll(/(\w+)\s*=\s*"?([^",)]+)"?/gi)) {
    params[k.toLowerCase()] = v.trim()
  }
  const amt = parseFloat(params.amount ?? params.amt ?? '0')
  if (!amt) return null
  const rawType = (params.type ?? 'expense').toLowerCase()
  const type = rawType === 'income' ? 'Income' : rawType === 'transfer' ? 'Transfer' : 'Expense'
  const rawCat = params.category ?? params.cat ?? ''
  const allCats: readonly string[] = type === 'Income' ? INCOME_CATS : CATEGORIES
  const cat = allCats.find(c => c.toLowerCase() === rawCat.toLowerCase()) ?? (type === 'Income' ? 'Other Income' : 'Others')
  const rawMode = params.mode ?? 'cash'
  const mode = (ALL_MODES as readonly string[]).find(m => m.toLowerCase() === rawMode.toLowerCase()) ?? 'Cash'
  const desc = params.desc ?? params.description ?? cat
  return { amt, desc, cat, type, mode }
}

function todayStr() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}-${MNS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`
}

export default function AIPanel({ open, onClose, onSaved }: Props) {
  const { state } = useStore()
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'a', text: '👋 Hi! I can:<br/>• <b>Add</b> — <b>500 vegetables cash</b> or <b>5000 salary hdfc</b><br/>• <b>List</b> — <b>show groceries</b> or <b>list this month expenses</b><br/>• <b>Analyse</b> — <b>where am I overspending?</b> or <b>how are my savings?</b>' }
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

    const direct = parseDirectCommand(text)
    if (direct) {
      try {
        await api.addRow({ month: state.month, year: state.year, date: todayStr(), desc: direct.desc, a: direct.amt, c: direct.cat, t: direct.type, m: direct.mode, notes: '' })
        setMsgs(m => [...m, { role: 'a', text: `✅ Added <b>${INR(direct.amt)}</b> → ${direct.cat} <span style="opacity:.7;font-size:11px">(${direct.type} · ${direct.mode} · ${todayStr()})</span>` }])
        onSaved()
      } catch (e) {
        setMsgs(m => [...m, { role: 'a', text: '⚠ ' + (e instanceof Error ? e.message : 'Error') }])
      } finally { setBusy(false) }
      return
    }

    const cm = catMap(state.rows, state.budget)
    const { totalBudget, totalSpent, ovCount } = budgetSummary(state.budget, cm)
    const flows = acctFlows(state.rows, state.openingBal)
    const ctx = {
      month: state.month + ' ' + state.year,
      inc: Math.round(sumType(state.rows, 'Income')),
      exp: Math.round(sumType(state.rows, 'Expense')),
      allCats: Object.entries(cm).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1])
        .map(([c,v])=>({ c, spent: Math.round(v), budget: state.budget[c]||0 })),
      overspent: Object.entries(state.budget).filter(([c,b])=>b>0&&(cm[c]||0)>b)
        .map(([c,b])=>({c, budget: b, spent: Math.round(cm[c]||0), over: Math.round((cm[c]||0)-b)})),
      accounts: ACCOUNTS.map(a => ({ a, bal: Math.round(flows[a]?.current||0) })),
      credits: [...CC_MODES, ...OTHER_CR].map(m => ({
        m, outstanding: Math.round(state.rows.filter(r=>r.m===m).reduce((s,r)=>s+r.a,0))
      })).filter(x => x.outstanding > 0),
      totalBudget, totalSpent, ovCount,
    }
    // Transaction needs a number AND must not be a question/listing request
    const hasNumber = /\d/.test(text)
    const isQuery = /[?]$/.test(text.trim()) ||
      /^(how|what|where|when|why|show|list|give|tell|display|any|are|is|was|did|do|can|which)\b/i.test(text.trim())
    const looksLikeTransaction = hasNumber && !isQuery

    const txnPrompt = [
      'Extract a transaction from the user input and call add_transaction. Rules:',
      'amt: the number.',
      'desc: the place, vendor, or item (e.g. "Auto", "A1 Mart", "Petrol bunk", "Amazon"). Not the category name. If no vendor/place is mentioned, use the category name as desc.',
      'type: Expense by default. Income if money received. Transfer if moving between accounts.',
      'mode: payment method mapping —',
      '  "cash/hand/பணம்" → Cash,',
      '  "icici/icici card/icici cc" → ICICI,',
      '  "hdfc card/hdfc cc/hdfc credit" → HDFC,',
      '  "hdfc bank/hdfc debit/hdfc account/hdfcbank" → HDFC Bank,',
      '  "wallet/gpay/google pay/phonepay/phonepe/paytm/upi" → Wallet.',
      '  Default to Cash if no payment method mentioned.',
      'cat: best-fit category —',
      '  auto/cab/uber/ola/bus/train/fuel/petrol → Travel,',
      '  vegetables/kirana/supermarket/bigbasket/dmart → Groceries,',
      '  restaurant/swiggy/zomato/hotel/food → Food/Eating Out,',
      '  milk/dairy → Milk,',
      '  medicine/doctor/hospital/pharmacy → Health & Medical,',
      '  school/fees/books/tuition → Education,',
      '  amazon/flipkart/online shopping/clothes → Dress or Others,',
      '  electricity/eb bill → Electricity,',
      '  mobile/internet/recharge/jio/airtel → Internet/Recharge.',
      'ALWAYS call the tool. Never reply in text.',
      'Examples:',
      '"500 Cash for Travel in Auto" → amt=500, desc="Auto", cat=Travel, type=Expense, mode=Cash.',
      '"1000 ICICI to buy Groceries in A1 Mart" → amt=1000, desc="A1 Mart", cat=Groceries, type=Expense, mode=ICICI.',
      '"200 wallet swiggy dinner" → amt=200, desc="Swiggy dinner", cat=Food/Eating Out, type=Expense, mode=Wallet.',
      '"50000 salary hdfc bank" → amt=50000, desc="Salary", cat=Salary, type=Income, mode=HDFC Bank.',
    ].join(' ')

    const analysisPrompt = [
      'You are a personal finance assistant for a family in India.',
      'Monthly income: ₹2,38,000. Fixed: Loan EMI ₹56k, Jewel Loan ₹30k, Insurance ₹9.7k, SIP ₹11.5k, Rent ₹5.5k, Vijaya Amma ₹6.5k, Staff ₹18k.',
      `${ctx.month}: Income ${INR(ctx.inc)}, Expenses ${INR(ctx.exp)}.`,
      `Spending: ${JSON.stringify(ctx.allCats)}.`,
      `Overspent: ${JSON.stringify(ctx.overspent)}.`,
      `Balances: ${JSON.stringify(ctx.accounts)}.`,
      `Credits: ${JSON.stringify(ctx.credits)}.`,
      'Reply in plain text under 150 words. Use specific numbers. Be direct and actionable.',
    ].join(' ')

    const system = looksLikeTransaction ? txnPrompt : analysisPrompt

    try {
      const reply = await api.gemini(system, text, looksLikeTransaction)
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
      // list_transactions tool call
      try {
        const j = JSON.parse(reply)
        if (j.__tool === 'list_transactions') {
          const filtered = state.rows.filter(r =>
            (!j.cat || r.c === j.cat) && (!j.type || r.t === j.type)
          ).slice(0, j.limit || 10)
          if (!filtered.length) {
            setMsgs(m => [...m, { role: 'a', text: `No transactions found${j.cat ? ' for <b>' + j.cat + '</b>' : ''}.` }])
            return
          }
          const rowsHtml = filtered.map(r =>
            `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(0,0,0,.07);font-size:12px">` +
            `<span>${r.date} · ${r.desc}</span>` +
            `<span style="font-weight:700;font-family:monospace;margin-left:8px">${INR(r.a)}</span></div>`
          ).join('')
          const total = filtered.reduce((s, r) => s + r.a, 0)
          setMsgs(m => [...m, { role: 'a', text:
            `<b>${j.cat || (j.type || 'Transactions')}</b> — ${filtered.length} entries<br/>${rowsHtml}` +
            `<div style="text-align:right;margin-top:5px;font-weight:700;font-size:12px">Total: ${INR(total)}</div>`
          }])
          return
        }
      } catch {}
      // Fallback: model returned add_transaction(...) as text instead of calling the tool
      const stripped = reply.replace(/```[\w]*\n?/g, '').trim()
      const fallback = parseDirectCommand(stripped)
      if (fallback) {
        await api.addRow({ month: state.month, year: state.year, date: todayStr(), desc: fallback.desc, a: fallback.amt, c: fallback.cat, t: fallback.type, m: fallback.mode, notes: '' })
        setMsgs(m => [...m, { role: 'a', text: `✅ Added <b>${INR(fallback.amt)}</b> → ${fallback.cat} <span style="opacity:.7;font-size:11px">(${fallback.type} · ${fallback.mode} · ${todayStr()})</span>` }])
        onSaved()
        return
      }
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

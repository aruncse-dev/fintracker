import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../api'
import BottomNav from '../components/BottomNav'
import Dashboard from './Dashboard'
import Transactions from './Transactions'
import Budget from './Budget'
import Credits from './Credits'
import Accounts from './Accounts'
import TransactionModal from '../components/TransactionModal'
import AIPanel from '../components/AIPanel'
import { MNS } from '../constants'

type TabId = 'dash' | 'txns' | 'bud' | 'cc' | 'acct'

const CC_CYCLE_DAY = 19
function cycleSubtitle(month: string) {
  const mi = MNS.indexOf(month as typeof MNS[number])
  const prevMi = mi === 0 ? 11 : mi - 1
  return `${CC_CYCLE_DAY} ${MNS[prevMi]} – ${CC_CYCLE_DAY - 1} ${month}`
}

export default function Monthly() {
  const { state, dispatch } = useStore()
  const [tab, setTab] = useState<TabId>('dash')
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<typeof state.rows[0] | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [status, setStatus] = useState('')

  const showStatus = useCallback((msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(''), 3000)
  }, [])

  const loadMonth = useCallback(async (month: string, year: string) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const rows = await api.getData(month, year)
      dispatch({ type: 'SET_ROWS', payload: rows })
      showStatus('✓ ' + month + ' ' + year)
    } catch (e) {
      showStatus('⚠ ' + (e instanceof Error ? e.message : 'Load failed'))
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [dispatch, showStatus])

  useEffect(() => {
    ;(async () => {
      try {
        const sheetId = import.meta.env.VITE_SHEET_ID as string
        if (sheetId) await api.configure(sheetId)
        const init = await api.init()
        dispatch({ type: 'SET_MONTHS', payload: init.months })
        dispatch({ type: 'SET_BUDGET', payload: init.budget })
        dispatch({ type: 'SET_OPENING_BAL', payload: init.openingBal })
        await loadMonth(state.month, state.year)
      } catch (e) {
        showStatus('⚠ ' + (e instanceof Error ? e.message : 'Failed to connect to backend'))
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    })()
  }, []) // eslint-disable-line

  const changeMonth = useCallback(async (dir: 1 | -1) => {
    const idx = MNS.indexOf(state.month as typeof MNS[number])
    let newIdx = idx + dir
    let newYear = parseInt(state.year)
    if (newIdx < 0) { newIdx = 11; newYear-- }
    if (newIdx > 11) { newIdx = 0; newYear++ }
    const newMonth = MNS[newIdx]
    dispatch({ type: 'SET_MONTH', payload: { month: newMonth, year: String(newYear) } })
    await loadMonth(newMonth, String(newYear))
  }, [state.month, state.year, dispatch, loadMonth])

  return (
    <div className="monthly-wrap">
      {/* Month nav sub-header */}
      <nav className="nav-sub">
        {status && <span className="nav-status show">{status}</span>}
        <div className="nav-month" style={{ flex: 1, justifyContent: 'center' }}>
          <button className="nav-arrow" onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></button>
          <div className="nav-ml">
            {state.month} {state.year}
            <div style={{ fontSize: 9, opacity: .65, fontWeight: 400 }}>{cycleSubtitle(state.month)}</div>
          </div>
          <button className="nav-arrow" onClick={() => changeMonth(1)}><ChevronRight size={16} /></button>
        </div>
        <button className="nav-sync" onClick={() => loadMonth(state.month, state.year)} disabled={state.loading}>
          {state.loading ? '…' : <RefreshCw size={13} />}
        </button>
      </nav>

      <BottomNav tab={tab} onTab={(id) => setTab(id)} />

      <main>
        {tab === 'dash' && <Dashboard onAddClick={() => { setEditRow(null); setModalOpen(true) }} />}
        {tab === 'txns' && <Transactions onEdit={r => { setEditRow(r); setModalOpen(true) }} onAddClick={() => { setEditRow(null); setModalOpen(true) }} />}
        {tab === 'bud'  && <Budget showStatus={showStatus} onCategoryClick={cat => { dispatch({ type:'SET_CAT_FILTER', payload:cat }); setTab('txns') }} />}
        {tab === 'cc'   && <Credits />}
        {tab === 'acct' && <Accounts showStatus={showStatus} />}
      </main>

      {/* FAB — AI assistant */}
      <button
        onClick={() => setAiOpen(true)}
        style={{ position:'fixed', bottom:24, right:20, width:52, height:52, borderRadius:'50%', background:'var(--navy-dark)', color:'#fff', fontSize:24, border:'2px solid #A5B4FC', boxShadow:'0 4px 16px rgba(30,27,75,.4)', cursor:'pointer', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}
        title="AI assistant"
      >🤖</button>

      {modalOpen && (
        <TransactionModal
          row={editRow}
          month={state.month} year={state.year}
          onClose={() => setModalOpen(false)}
          onSaved={async () => {
            setModalOpen(false)
            await loadMonth(state.month, state.year)
            showStatus('✓ Saved')
          }}
          showStatus={showStatus}
        />
      )}

      <AIPanel open={aiOpen} onClose={() => setAiOpen(false)} onSaved={() => loadMonth(state.month, state.year)} />
    </div>
  )
}

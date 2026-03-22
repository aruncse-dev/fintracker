import { useState, useEffect, useCallback, useRef } from 'react'
import { StoreProvider, useStore } from './store'
import { api } from './api'
import Nav from './components/Nav'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Budget from './pages/Budget'
import Credits from './pages/Credits'
import Accounts from './pages/Accounts'
import TransactionModal from './components/TransactionModal'
import AIPanel from './components/AIPanel'
import { ALLOWED_EMAILS, MNS } from './constants'

type TabId = 'dash' | 'txns' | 'bud' | 'cc' | 'acct'

function InstallBanner() {
  const deferredPrompt = useRef<Event & { prompt: () => void } | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); deferredPrompt.current = e as any; setShow(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!show) return null
  return (
    <div style={{position:'fixed',top:106,left:12,right:12,background:'var(--card)',border:'1px solid var(--border)',borderLeft:'4px solid var(--navy)',borderRadius:10,padding:'10px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',zIndex:150,boxShadow:'0 4px 16px rgba(55,48,163,.12)'}}>
      <span style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>📱 Add FinTracker to home screen</span>
      <div style={{display:'flex',gap:6,flexShrink:0}}>
        <button style={{background:'var(--navy)',color:'#fff',border:'none',borderRadius:8,padding:'5px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}} onClick={() => { deferredPrompt.current?.prompt(); setShow(false) }}>Install</button>
        <button style={{background:'none',border:'none',color:'var(--muted)',fontSize:18,cursor:'pointer',lineHeight:1,padding:'0 2px'}} onClick={() => setShow(false)}>×</button>
      </div>
    </div>
  )
}

function Inner() {
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
    <div style={{ minHeight: '100vh' }}>
      <Nav
        month={state.month} year={state.year}
        status={status} loading={state.loading}
        onPrev={() => changeMonth(-1)} onNext={() => changeMonth(1)}
        onSync={() => loadMonth(state.month, state.year)}
      />

      <BottomNav tab={tab} onTab={(id) => setTab(id)} />

      <main>
        {tab === 'dash' && <Dashboard onAddClick={() => { setEditRow(null); setModalOpen(true) }} />}
        {tab === 'txns' && <Transactions onEdit={r => { setEditRow(r); setModalOpen(true) }} onAddClick={() => { setEditRow(null); setModalOpen(true) }} />}
        {tab === 'bud'  && <Budget showStatus={showStatus} />}
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

      <AIPanel open={aiOpen} onClose={() => setAiOpen(false)} />
      <InstallBanner />
    </div>
  )
}

function tryOAuthCallback(): boolean {
  if (!window.location.hash.includes('id_token=')) return false
  const params = new URLSearchParams(window.location.hash.slice(1))
  const idToken = params.get('id_token')
  if (!idToken) return false
  window.history.replaceState(null, '', window.location.pathname)
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]))
    const email: string = payload.email || ''
    if (ALLOWED_EMAILS.includes(email.toLowerCase())) {
      localStorage.setItem('ft_auth', '1')
      localStorage.setItem('ft_email', email)
      return true
    }
    alert('Access denied: ' + email)
  } catch { /* ignore */ }
  return false
}

function LoginScreen() {
  const handleLogin = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
    const redirectUri = import.meta.env.DEV
      ? 'http://localhost:5173/'
      : 'https://aruncse-dev.github.io/fintracker/'
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'id_token',
      scope: 'email profile',
      nonce: Math.random().toString(36).slice(2),
    })
    window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params
  }
  return (
    <div className="login-screen">
      <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" width="88" height="88" style={{borderRadius:20,flexShrink:0}}>
        <rect width="512" height="512" rx="112" fill="#312E81"/>
        <rect x="80"  y="340" width="72" height="120" rx="14" fill="#4338CA" opacity="0.7"/>
        <rect x="180" y="270" width="72" height="190" rx="14" fill="#4F46E5" opacity="0.85"/>
        <rect x="280" y="185" width="72" height="275" rx="14" fill="#6366F1"/>
        <rect x="380" y="100" width="72" height="360" rx="14" fill="#818CF8"/>
        <polyline points="116,328 216,258 316,172 416,88" fill="none" stroke="#E0E7FF" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="376,72 416,88 400,128" fill="none" stroke="#E0E7FF" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="116" cy="328" r="14" fill="#C7D2FE"/>
        <circle cx="216" cy="258" r="14" fill="#C7D2FE"/>
        <circle cx="316" cy="172" r="14" fill="#C7D2FE"/>
        <circle cx="416" cy="88"  r="14" fill="#E0E7FF"/>
      </svg>
      <div className="login-title">FinTracker</div>
      <div className="login-sub">Personal finance tracker for Arun's family</div>
      <button className="btn" style={{ fontSize: 15, padding: '12px 28px' }} onClick={handleLogin}>
        Sign in with Google
      </button>
    </div>
  )
}

export default function App() {
  const [authed] = useState(() => tryOAuthCallback() || localStorage.getItem('ft_auth') === '1')
  if (!authed) return <LoginScreen />
  return <StoreProvider><Inner /></StoreProvider>
}

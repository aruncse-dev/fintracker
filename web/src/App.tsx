import { useState, useEffect, useRef } from 'react'
import { StoreProvider } from './store'
import Nav, { ModuleId } from './components/Nav'
import ErrorScreen from './components/ErrorScreen'
import { Smartphone } from 'lucide-react'
import Monthly from './pages/Monthly'
import Lending from './pages/Lending'
import Savings from './pages/Savings'
import Gold from './pages/Gold'
import Stocks from './pages/Stocks'
import MutualFunds from './pages/MutualFunds'
import EMI from './pages/EMI'
import JewelLoans from './pages/JewelLoans'
import Settings from './pages/Settings'
import { ALLOWED_EMAILS } from './constants'

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
      <span style={{fontSize:13,fontWeight:600,color:'var(--text)',display:'flex',alignItems:'center',gap:6}}><Smartphone size={14} /> Add FinTracker to home screen</span>
      <div style={{display:'flex',gap:6,flexShrink:0}}>
        <button style={{background:'var(--navy)',color:'#fff',border:'none',borderRadius:8,padding:'5px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}} onClick={() => { deferredPrompt.current?.prompt(); setShow(false) }}>Install</button>
        <button style={{background:'none',border:'none',color:'var(--muted)',fontSize:18,cursor:'pointer',lineHeight:1,padding:'0 2px'}} onClick={() => setShow(false)}>×</button>
      </div>
    </div>
  )
}

function Inner() {
  const [module, setModule] = useState<ModuleId>('monthly')
  const [lendingSheet, setLendingSheet] = useState('Lending')

  const handleModuleChange = (id: ModuleId) => {
    setModule(id)
    if (id !== 'lending') setLendingSheet('Lending')
  }

  const getTitleForModule = (): string => {
    if (module === 'monthly') return 'Monthly Expenses'
    if (module === 'lending') return lendingSheet === 'Vijaya Amma' ? 'Vijaya Amma' : 'Lending'
    if (module === 'savings') return 'Savings'
    if (module === 'gold') return 'Gold'
    if (module === 'stocks') return 'Stocks'
    if (module === 'mutualfunds') return 'Mutual Funds'
    if (module === 'emi') return 'EMI Loans'
    if (module === 'jewelLoans') return 'Jewel Loans'
    if (module === 'settings') return 'Settings'
    return 'FinTracker'
  }

  return (
    <div style={{ minHeight: '100vh' }} className={module === 'monthly' ? 'with-app-shell' : ''}>
      <Nav module={module} onModule={handleModuleChange} lendingSheet={lendingSheet} onLendingSheet={setLendingSheet} title={getTitleForModule()} />
      {module === 'monthly'     && <Monthly />}
      {module === 'lending'     && <Lending key={lendingSheet} sheetName={lendingSheet} />}
      {module === 'savings'     && <Savings />}
      {module === 'gold'        && <Gold onOpenSettings={() => setModule('settings')} />}
      {module === 'stocks'      && <Stocks />}
      {module === 'mutualfunds' && <MutualFunds />}
      {module === 'emi'         && <EMI />}
      {module === 'jewelLoans'  && <JewelLoans />}
      {module === 'settings'    && <Settings />}
      <InstallBanner />
    </div>
  )
}

// Error boundary wrapper
function AppWithErrorBoundary() {
  const [apiError, setApiError] = useState<string | null>(null)
  const [shouldRetry, setShouldRetry] = useState(false)

  useEffect(() => {
    setShouldRetry(false)
  }, [shouldRetry])

  // Catch unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || String(event.reason) || ''
      if (msg.includes('GAS') && msg.includes('deployed')) {
        setApiError(msg)
        event.preventDefault()
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  }, [])

  if (apiError) {
    return <ErrorScreen error={apiError} onRetry={() => setApiError(null)} />
  }

  return <Inner />
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
  return <StoreProvider><AppWithErrorBoundary /></StoreProvider>
}

const MNS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const
const CC_CYCLE_DAY = 19

function cycleSubtitle(month: string) {
  const mi = MNS.indexOf(month as typeof MNS[number])
  const prevMi = mi === 0 ? 11 : mi - 1
  return `${CC_CYCLE_DAY} ${MNS[prevMi]} – ${CC_CYCLE_DAY - 1} ${month}`
}

interface Props {
  month: string; year: string; status: string; loading: boolean;
  onPrev: () => void; onNext: () => void; onSync: () => void;
}
export default function Nav({ month, year, status, loading, onPrev, onNext, onSync }: Props) {
  return (
    <nav className="nav">
      {/* Brand — left */}
      <span className="nav-b" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <svg width="28" height="28" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style={{borderRadius:7,flexShrink:0}}>
          <rect width="512" height="512" rx="112" fill="#EEF2FF"/>
          <rect x="80"  y="340" width="72" height="120" rx="14" fill="#6366F1" opacity="0.5"/>
          <rect x="180" y="270" width="72" height="190" rx="14" fill="#6366F1" opacity="0.7"/>
          <rect x="280" y="185" width="72" height="275" rx="14" fill="#4F46E5" opacity="0.85"/>
          <rect x="380" y="100" width="72" height="360" rx="14" fill="#3730A3"/>
          <polyline points="116,328 216,258 316,172 416,88" fill="none" stroke="#1E1B4B" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="376,72 416,88 400,128" fill="none" stroke="#1E1B4B" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="116" cy="328" r="16" fill="#4F46E5"/>
          <circle cx="416" cy="88"  r="16" fill="#1E1B4B"/>
        </svg>
        FinTracker
      </span>

      {/* Status — centre */}
      {status && <span className="nav-status show">{status}</span>}

      {/* Month nav — right */}
      <div className="nav-month">
        <button className="nav-arrow" onClick={onPrev}>‹</button>
        <div className="nav-ml">
          {month} {year}
          <div style={{ fontSize: 9, opacity: .65, fontWeight: 400 }}>{cycleSubtitle(month)}</div>
        </div>
        <button className="nav-arrow" onClick={onNext}>›</button>
      </div>

      <button className="nav-sync" onClick={onSync} disabled={loading} style={{ marginLeft: 6 }}>
        {loading ? '…' : '↻'}
      </button>
    </nav>
  )
}

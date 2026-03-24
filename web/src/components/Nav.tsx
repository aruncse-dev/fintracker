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
        <img src="./logo.svg" width="28" height="28" alt="FinTracker" style={{borderRadius:7,flexShrink:0,objectFit:'cover'}} />
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

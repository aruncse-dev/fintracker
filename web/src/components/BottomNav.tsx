type TabId = 'dash' | 'txns' | 'bud' | 'cc' | 'acct'
interface Props {
  tab: TabId; onTab: (id: TabId) => void;
}
const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'dash', icon: '📊', label: 'Dashboard' },
  { id: 'txns', icon: '📋', label: 'Transactions' },
  { id: 'acct', icon: '🏦', label: 'Accounts' },
  { id: 'cc',   icon: '💳', label: 'Credits' },
  { id: 'bud',  icon: '🎯', label: 'Budget' },
]
export default function TabBar({ tab, onTab }: Props) {
  return (
    <nav className="tab-bar">
      {TABS.map(t => (
        <button
          key={t.id}
          className={`tab-item${tab === t.id ? ' active' : ''}`}
          onClick={() => onTab(t.id)}
        >
          <span className="tab-icon">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

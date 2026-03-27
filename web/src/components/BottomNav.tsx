import React from 'react'
import { LayoutDashboard, ArrowLeftRight, Landmark, CreditCard, Target } from 'lucide-react'

type TabId = 'dash' | 'txns' | 'bud' | 'cc' | 'acct'
interface Props { tab: TabId; onTab: (id: TabId) => void }

const TABS: { id: TabId; icon: React.ReactNode; label: string }[] = [
  { id: 'dash', icon: <LayoutDashboard size={19} />, label: 'Dashboard' },
  { id: 'txns', icon: <ArrowLeftRight size={19} />, label: 'Transactions' },
  { id: 'acct', icon: <Landmark size={19} />,       label: 'Accounts' },
  { id: 'cc',   icon: <CreditCard size={19} />,     label: 'Credits' },
  { id: 'bud',  icon: <Target size={19} />,         label: 'Budget' },
]

export default function TabBar({ tab, onTab }: Props) {
  return (
    <nav className="tab-bar">
      {TABS.map(t => (
        <button key={t.id} className={`tab-item${tab === t.id ? ' active' : ''}`} onClick={() => onTab(t.id)}>
          <span className="tab-icon">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

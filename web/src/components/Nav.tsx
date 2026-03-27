import { useState } from 'react'
import { CalendarDays, Handshake, PiggyBank, Gem, TrendingUp, BarChart2 } from 'lucide-react'
import React from 'react'

export type ModuleId = 'monthly' | 'lending' | 'savings' | 'gold' | 'stocks' | 'mutualfunds'

interface Props { module: ModuleId; onModule: (id: ModuleId) => void }

const MODULES: { id: ModuleId; icon: React.ReactNode; label: string }[] = [
  { id: 'monthly',     icon: <CalendarDays size={15} />, label: 'Monthly' },
  { id: 'lending',     icon: <Handshake size={15} />,    label: 'Lending' },
  { id: 'savings',     icon: <PiggyBank size={15} />,    label: 'Savings' },
  { id: 'gold',        icon: <Gem size={15} />,          label: 'Gold' },
  { id: 'stocks',      icon: <TrendingUp size={15} />,   label: 'Stocks' },
  { id: 'mutualfunds', icon: <BarChart2 size={15} />,    label: 'Mutual Funds' },
]

const MODULES_LG: { id: ModuleId; icon: React.ReactNode; label: string }[] = [
  { id: 'monthly',     icon: <CalendarDays size={18} />, label: 'Monthly' },
  { id: 'lending',     icon: <Handshake size={18} />,    label: 'Lending' },
  { id: 'savings',     icon: <PiggyBank size={18} />,    label: 'Savings' },
  { id: 'gold',        icon: <Gem size={18} />,          label: 'Gold' },
  { id: 'stocks',      icon: <TrendingUp size={18} />,   label: 'Stocks' },
  { id: 'mutualfunds', icon: <BarChart2 size={18} />,    label: 'Mutual Funds' },
]

export default function Nav({ module, onModule }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <nav className="nav">
        {/* Brand — left */}
        <span className="nav-b" style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <img src="./apple-touch-icon.png" width="30" height="30" alt="FinTracker" style={{borderRadius:8,flexShrink:0,objectFit:'contain',background:'#1E3A8A'}} />
          FinTracker
        </span>

        {/* Hamburger — mobile only */}
        <button className="nav-hamburger" onClick={() => setDrawerOpen(true)}>☰</button>

        {/* Module nav pills — desktop only */}
        <div className="nav-modules">
          {MODULES.map(m => (
            <button
              key={m.id}
              onClick={() => onModule(m.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12, fontWeight: module === m.id ? 700 : 500,
                color: module === m.id ? '#fff' : 'rgba(255,255,255,0.6)',
                background: module === m.id ? 'rgba(255,255,255,0.18)' : 'transparent',
                whiteSpace: 'nowrap', transition: 'color .15s, background .15s',
                flexShrink: 0,
              }}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Overlay — closes drawer on outside click */}
      {drawerOpen && <div className="nav-overlay" onClick={() => setDrawerOpen(false)} />}

      {/* Drawer panel */}
      <div className={`nav-drawer${drawerOpen ? ' open' : ''}`}>
        <div className="nav-drawer-hd">
          <span className="nav-b" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <img src="./apple-touch-icon.png" width="28" height="28" alt="FinTracker" style={{borderRadius:7,flexShrink:0,objectFit:'contain',background:'#1E3A8A'}} />
            FinTracker
          </span>
          <button className="modal-close" onClick={() => setDrawerOpen(false)}>×</button>
        </div>
        {MODULES_LG.map(m => (
          <button
            key={m.id}
            className={`nav-drawer-item${module === m.id ? ' active' : ''}`}
            onClick={() => { onModule(m.id); setDrawerOpen(false) }}
          >
            {m.icon}
            <span>{m.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}

import { useState } from 'react'
import { CalendarDays, PiggyBank, Gem, TrendingUp, BarChart2, Wallet, User, Settings, CreditCard, Landmark } from 'lucide-react'
import React from 'react'

export type ModuleId = 'monthly' | 'lending' | 'savings' | 'gold' | 'stocks' | 'mutualfunds' | 'emi' | 'jewelLoans' | 'settings'

interface Props {
  module: ModuleId
  onModule: (id: ModuleId) => void
  lendingSheet?: string
  onLendingSheet?: (sheet: string) => void
  title?: string
}

const MODULES_LG: { id: ModuleId; icon: React.ReactNode; label: string }[] = [
  { id: 'monthly',     icon: <CalendarDays size={18} />, label: 'Monthly Expenses' },
  { id: 'savings',     icon: <PiggyBank size={18} />,    label: 'Savings' },
  { id: 'gold',        icon: <Gem size={18} />,          label: 'Gold' },
  { id: 'stocks',      icon: <TrendingUp size={18} />,   label: 'Stocks' },
  { id: 'mutualfunds', icon: <BarChart2 size={18} />,    label: 'Mutual Funds' },
]

const LENDING_SUBMENU = [
  { id: 'Lending', label: 'Lending', icon: <Wallet size={18} /> },
  { id: 'Vijaya Amma', label: 'Vijaya Amma', icon: <User size={18} /> },
]

export default function Nav({ module, onModule, lendingSheet, onLendingSheet, title }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <nav className="nav">
        {/* Brand — left */}
        <span className="nav-b" style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <img src="./apple-touch-icon.png" width="30" height="30" alt="FinTracker" style={{borderRadius:8,flexShrink:0,objectFit:'contain',background:'#1E3A8A'}} />
          {title && <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>}
        </span>

        {/* Hamburger */}
        <button className="nav-hamburger" onClick={() => setDrawerOpen(true)}>☰</button>
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

        {/* Primary Section — Tracking */}
        <div style={{ paddingTop: 12, paddingBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '.04em', padding: '12px 14px 8px 14px', marginBottom: 4 }}>
            Tracking
          </div>
          {MODULES_LG.slice(0, 2).map(m => (
            <button
              key={m.id}
              onClick={() => { onModule(m.id); setDrawerOpen(false) }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 0,
                background: 'transparent',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 16,
                fontWeight: 500,
                transition: 'all .15s',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--border)', margin: '8px 14px' }} />

        {/* Assets Section */}
        <div style={{ paddingTop: 12, paddingBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '.04em', padding: '12px 14px 8px 14px', marginBottom: 4 }}>
            Assets
          </div>
          {MODULES_LG.slice(2).map(m => (
            <button
              key={m.id}
              onClick={() => { onModule(m.id); setDrawerOpen(false) }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 0,
                background: 'transparent',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 16,
                fontWeight: 500,
                transition: 'all .15s',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--border)', margin: '8px 14px' }} />

        {/* Balances Section */}
        <div style={{ paddingTop: 12, paddingBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '.04em', padding: '12px 14px 8px 14px', marginBottom: 4 }}>
            Balances
          </div>

          {/* Lending Submenu Items */}
          {onLendingSheet && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {LENDING_SUBMENU.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => { onModule('lending'); onLendingSheet(sub.id); setDrawerOpen(false) }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 14px',
                    borderRadius: 0,
                    background: module === 'lending' && lendingSheet === sub.id ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 16,
                    fontWeight: module === 'lending' && lendingSheet === sub.id ? 500 : 400,
                    transition: 'all .15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  {sub.icon}
                  <span>{sub.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--border)', margin: '8px 14px' }} />

        {/* Loans Section */}
        <div style={{ paddingTop: 12, paddingBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '.04em', padding: '12px 14px 8px 14px', marginBottom: 4 }}>
            Loans
          </div>
          <button
            onClick={() => { onModule('emi'); setDrawerOpen(false) }}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: 0,
              background: module === 'emi' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 16,
              fontWeight: module === 'emi' ? 500 : 400,
              transition: 'all .15s',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <CreditCard size={18} />
            <span>EMI Loans</span>
          </button>
          <button
            onClick={() => { onModule('jewelLoans'); setDrawerOpen(false) }}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: 0,
              background: module === 'jewelLoans' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 16,
              fontWeight: module === 'jewelLoans' ? 500 : 400,
              transition: 'all .15s',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Landmark size={18} />
            <span>Jewel Loans</span>
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--border)', margin: '8px 14px' }} />

        {/* Settings Section */}
        <div style={{ paddingTop: 12, paddingBottom: 8 }}>
          <button
            onClick={() => { onModule('settings'); setDrawerOpen(false) }}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: 0,
              background: 'transparent',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 16,
              fontWeight: 500,
              transition: 'all .15s',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </>
  )
}

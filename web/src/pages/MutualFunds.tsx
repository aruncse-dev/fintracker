import { useEffect, useState, useMemo } from 'react';
import { BarChart3, PieChart } from 'lucide-react';
import { api } from '../api';

interface Holding {
  symbol: string;
  company: string;
  isin: string;
  qty: number;
  avgPrice: number;
  lastPrice: number;
  pnl: number;
  dayChangePct: number;
  synced: string;
}

export default function MutualFunds() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Load holdings on mount
  useEffect(() => {
    loadHoldings();
  }, []);

  const loadHoldings = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getMutualFunds();
      console.log('MF Data received:', data);
      setHoldings(data as Holding[]);
    } catch (err: any) {
      console.error('Failed to load holdings:', err);
      setError(err.message || 'Failed to load holdings');
    } finally {
      setLoading(false);
    }
  };

  const enrichedHoldings = useMemo(() => {
    return holdings.map(h => {
      const invested = h.qty * h.avgPrice;
      const current = h.qty * h.lastPrice;
      const pnlPct = invested > 0 ? ((h.pnl / invested) * 100) : 0;
      return {
        ...h,
        invested,
        current,
        pnlPct
      };
    });
  }, [holdings]);

  const stats = useMemo(() => {
    if (holdings.length === 0) {
      return { totalInvested: 0, currentValue: 0, totalPnL: 0, totalPnLPct: 0 };
    }
    const totalInvested = holdings.reduce((sum, h) => sum + (h.qty * h.avgPrice), 0);
    const currentValue = holdings.reduce((sum, h) => sum + (h.qty * h.lastPrice), 0);
    const totalPnL = currentValue - totalInvested;
    const totalPnLPct = totalInvested > 0 ? ((totalPnL / totalInvested) * 100) : 0;
    return { totalInvested, currentValue, totalPnL, totalPnLPct };
  }, [holdings]);

  return (
    <div className="pg">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart3 size={20} style={{ color: 'var(--text)' }} />
          <div className="sec-h" style={{ margin: 0 }}>Metrics</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
              <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTop: '2px solid var(--text)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          padding: '1rem',
          background: '#FEE2E2',
          color: '#991B1B',
          borderRadius: '0.375rem',
          marginBottom: '1rem',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      {/* Summary strip - KPIs */}
      <div className="kpis" style={{ marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
                Total Invested
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                ₹{Number(stats.totalInvested.toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="card" style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
                Current Value
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                ₹{Number(stats.currentValue.toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="card" style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
                Total P&L
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: stats.totalPnL >= 0 ? '#10B981' : '#EF4444' }}>
                {stats.totalPnL >= 0 ? '+' : ''}₹{Number(stats.totalPnL.toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="card" style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
                Return %
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: stats.totalPnLPct >= 0 ? '#10B981' : '#EF4444' }}>
                {stats.totalPnLPct >= 0 ? '+' : ''}{Number(stats.totalPnLPct.toFixed(2))}%
              </div>
            </div>
      </div>

      {/* Holdings content */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
          Loading holdings...
        </div>
      ) : holdings.length === 0 ? (
        <div className="sec">
          <div style={{
            padding: '1.5rem',
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '0.375rem',
            textAlign: 'center'
          }}>
            <p style={{ marginBottom: '0.75rem', color: 'var(--text)', fontSize: '0.875rem' }}>
              No mutual fund holdings found.
            </p>
            <p style={{ marginBottom: 0, color: 'var(--muted)', fontSize: '0.75rem' }}>
              Update the MutualFunds sheet in your Assets spreadsheet to load your data.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Holdings section header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <PieChart size={20} style={{ color: 'var(--text)' }} />
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>Mutual Funds</div>
          </div>

          {/* Holdings as cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1rem'
          }}>
            {enrichedHoldings.map((h, i) => (
              <div
                key={i}
                onClick={() => setSelectedIndex(i)}
                style={{
                  padding: '0.875rem',
                  background: '#FFFFFF',
                  border: '1px solid var(--border)',
                  borderRadius: '0.375rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                {/* Fund name */}
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '0.1rem' }}>FUND NAME</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, lineHeight: '1.3' }}>{h.company}</div>
                </div>

                {/* Units & P&L */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '0.1rem' }}>UNITS</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{Number(h.qty.toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                  <div style={{
                    padding: '0.5rem 0.625rem',
                    background: h.pnl >= 0 ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                    borderRadius: '0.375rem',
                    borderLeft: `3px solid ${h.pnl >= 0 ? '#16A34A' : '#DC2626'}`
                  }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '0.1rem' }}>P&L</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: h.pnl >= 0 ? '#16A34A' : '#DC2626' }}>
                      {h.pnl >= 0 ? '+' : ''}₹{Number(h.pnl.toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                  Click to view details
                </div>
              </div>
            ))}
          </div>

        {/* Modal */}
        {selectedIndex !== null && enrichedHoldings[selectedIndex] && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'flex-end',
              zIndex: 1000
            }}
            onClick={() => setSelectedIndex(null)}
          >
            <div
              style={{
                background: '#FFFFFF',
                width: '100%',
                borderRadius: '1rem 1rem 0 0',
                padding: '1.5rem',
                maxHeight: '80vh',
                overflowY: 'auto',
                animation: 'slideUp 0.3s ease'
              }}
              onClick={e => e.stopPropagation()}
            >
              {(() => {
                const h = enrichedHoldings[selectedIndex];
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 700 }}>{h.company}</div>
                      <button
                        onClick={() => setSelectedIndex(null)}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '1.5rem',
                          cursor: 'pointer',
                          color: 'var(--muted)',
                          padding: 0
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '0.1rem', textTransform: 'uppercase', fontWeight: 600 }}>Folio</div>
                        <div style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{h.isin}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '0.1rem', textTransform: 'uppercase', fontWeight: 600 }}>Code</div>
                        <div style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{h.symbol}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '0.1rem', textTransform: 'uppercase', fontWeight: 600 }}>Units</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{Number(h.qty.toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '0.1rem', textTransform: 'uppercase', fontWeight: 600 }}>Avg Price</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>₹{Number(h.avgPrice.toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '0.1rem', textTransform: 'uppercase', fontWeight: 600 }}>Invested</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>₹{Number(h.invested.toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '0.1rem', textTransform: 'uppercase', fontWeight: 600 }}>Current</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>₹{Number(h.current.toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </div>
                    </div>

                    <div style={{
                      padding: '0.75rem',
                      background: h.pnl >= 0 ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                      borderRadius: '0.375rem',
                      borderLeft: `4px solid ${h.pnl >= 0 ? '#16A34A' : '#DC2626'}`
                    }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '0.1rem', textTransform: 'uppercase', fontWeight: 600 }}>Profit / Loss</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: h.pnl >= 0 ? '#16A34A' : '#DC2626' }}>
                          {h.pnl >= 0 ? '+' : ''}₹{Number(h.pnl.toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: h.pnlPct >= 0 ? '#16A34A' : '#DC2626' }}>
                          ({h.pnlPct >= 0 ? '+' : ''}{Number(h.pnlPct.toFixed(2))}%)
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
        </>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

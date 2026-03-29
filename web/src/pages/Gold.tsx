import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Plus, X, Check, Trash2, AlertTriangle, Loader2, Search, Pencil, LayoutDashboard, List, Settings as SettingsIcon, TrendingUp, Scale, Clock } from 'lucide-react';
import { api, RawGoldRow, RawGoldHistoryRow } from '../api';
import { INR } from '../utils';

// ──────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

type GoldTab = 'dashboard' | 'items' | 'history';

interface GoldItem {
  id: string;
  name: string;
  weight_g: number;
  pavan: number;
  person: string;
  location: string;
}

interface GoldHistoryItem {
  id: string;
  date: string;
  type: 'IN' | 'OUT';
  name: string;
  weight_g: number;
  note?: string;
}

interface GoldFormState {
  name: string;
  weight_g: string;
  pavan: string;
  person: string;
  location: string;
}

interface GoldHistoryFormState {
  date: string;
  type: 'IN' | 'OUT';
  name: string;
  weight_g: string;
  note: string;
}

const PEOPLE = ['Ramya', 'Arun', 'Nithran', 'Dhuruvan', 'Amma'];
const LOCATIONS = ['Home', 'Bank', 'Locker'];
const PAVAN_CONVERSION = 1 / 8; // 1 pavan = 8 grams

function emptyForm(): GoldFormState {
  return {
    name: '',
    weight_g: '',
    pavan: '',
    person: 'Ramya',
    location: 'Home',
  };
}

function emptyHistoryForm(): GoldHistoryFormState {
  return {
    date: new Date().toISOString().split('T')[0],
    type: 'IN',
    name: '',
    weight_g: '',
    note: '',
  };
}

function parseRow(raw: RawGoldRow): GoldItem | null {
  const weight_g = parseFloat(String(raw.weight_g));
  const pavan = parseFloat(String(raw.pavan));
  if (isNaN(weight_g) || isNaN(pavan)) return null;
  return {
    id: raw.id,
    name: String(raw.name ?? '').trim(),
    weight_g,
    pavan,
    person: String(raw.person ?? '').trim(),
    location: String(raw.location ?? '').trim(),
  };
}

function normalizeDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];

  // Try to parse and normalize to YYYY-MM-DD
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  // If parsing fails, try to extract YYYY-MM-DD pattern
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  // Fallback to today's date
  return new Date().toISOString().split('T')[0];
}

function parseHistoryRow(raw: RawGoldHistoryRow): GoldHistoryItem | null {
  const weight_g = parseFloat(String(raw.weight_g));
  if (isNaN(weight_g)) return null;
  const type = String(raw.type ?? '').trim().toUpperCase() as 'IN' | 'OUT';
  if (type !== 'IN' && type !== 'OUT') return null;
  return {
    id: raw.id,
    date: normalizeDate(String(raw.date ?? '')),
    type,
    name: String(raw.name ?? '').trim(),
    weight_g,
    note: raw.note ? String(raw.note).trim() : undefined,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ──────────────────────────────────────────────────────────────────────────────

const PersonCard = memo(function PersonCard({
  person,
  items,
}: {
  person: string;
  items: GoldItem[];
}) {
  const totalGrams = items.reduce((s, i) => s + i.weight_g, 0);
  const totalPavan = items.reduce((s, i) => s + i.pavan, 0);
  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div className="lbl" style={{ marginBottom: 4 }}>{person}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
        {Math.round(totalGrams)}g
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
        {totalPavan.toFixed(3)} pavan
      </div>
    </div>
  );
});

const LocationCard = memo(function LocationCard({
  location,
  items,
}: {
  location: string;
  items: GoldItem[];
}) {
  const totalGrams = items.reduce((s, i) => s + i.weight_g, 0);
  const totalPavan = items.reduce((s, i) => s + i.pavan, 0);
  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div className="lbl" style={{ marginBottom: 4 }}>{location}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
        {Math.round(totalGrams)}g
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
        {totalPavan.toFixed(3)} pavan
      </div>
    </div>
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────────────

export default function Gold({ onOpenSettings }: { onOpenSettings: () => void }) {
  // Tab navigation
  const [activeTab, setActiveTab] = useState<GoldTab>('dashboard');

  // Data
  const [items, setItems] = useState<GoldItem[]>([]);
  const [history, setHistory] = useState<GoldHistoryItem[]>([]);
  const [goldRate, setGoldRate] = useState(7500);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Items filter
  const [itemsSearch, setItemsSearch] = useState('');

  // Items modal
  const [itemsModalOpen, setItemsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<GoldItem | null>(null);
  const [form, setForm] = useState<GoldFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  // History modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyForm, setHistoryForm] = useState<GoldHistoryFormState>(emptyHistoryForm());
  const [historySaving, setHistorySaving] = useState(false);
  const [editHistory, setEditHistory] = useState<GoldHistoryItem | null>(null);
  const [historyDelConfirm, setHistoryDelConfirm] = useState(false);

  // Derivations
  const totalGrams = useMemo(() => items.reduce((s, i) => s + i.weight_g, 0), [items]);
  const totalPavan = useMemo(() => items.reduce((s, i) => s + i.pavan, 0), [items]);

  // Estimated value only for Home & Locker (excludes Bank)
  const personalGrams = useMemo(() =>
    items
      .filter(i => i.location === 'Home' || i.location === 'Locker')
      .reduce((s, i) => s + i.weight_g, 0)
  , [items]);
  const estimatedValue = useMemo(() => personalGrams * goldRate, [personalGrams, goldRate]);

  const groupedByPerson = useMemo(() => {
    const groups: Record<string, GoldItem[]> = {};
    items.forEach(i => {
      if (!groups[i.person]) groups[i.person] = [];
      groups[i.person].push(i);
    });
    return groups;
  }, [items]);

  const groupedByLocation = useMemo(() => {
    const groups: Record<string, GoldItem[]> = {};
    items.forEach(i => {
      if (!groups[i.location]) groups[i.location] = [];
      groups[i.location].push(i);
    });
    return groups;
  }, [items]);

  const filteredItems = useMemo(() => {
    return items
      .filter(i => {
        const q = itemsSearch.toLowerCase();
        return !q || i.name.toLowerCase().includes(q)
          || i.person.toLowerCase().includes(q)
          || i.location.toLowerCase().includes(q);
      })
      .sort((a, b) => b.weight_g - a.weight_g);
  }, [items, itemsSearch]);

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rows, settings, historyRows] = await Promise.all([
        api.getGold(),
        api.getSettings(),
        api.getGoldHistory(),
      ]);
      setItems(rows.map(parseRow).filter((i): i is GoldItem => i !== null));
      setGoldRate(settings.goldRate);
      setHistory(historyRows.map(parseHistoryRow).filter((h): h is GoldHistoryItem => h !== null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Items handlers
  function openEditItem(i: GoldItem) {
    setEditItem(i);
    setForm({
      name: i.name,
      weight_g: String(i.weight_g),
      pavan: String(i.pavan),
      person: i.person,
      location: i.location,
    });
    setDelConfirm(false);
    setItemsModalOpen(true);
  }

  function setField<K extends keyof GoldFormState>(k: K, v: GoldFormState[K]) {
    setForm(f => {
      const updated = { ...f, [k]: v };
      // Auto-calculate pavan from weight_g
      if (k === 'weight_g') {
        const wg = parseFloat(String(v));
        updated.pavan = isNaN(wg) ? '' : String((wg * PAVAN_CONVERSION).toFixed(2));
      }
      return updated;
    });
  }

  async function saveItem() {
    if (!form.name.trim() || !form.weight_g) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      weight_g: parseFloat(form.weight_g),
      pavan: parseFloat(form.pavan),
      person: form.person,
      location: form.location,
    };
    try {
      if (editItem) {
        await api.updateGold({ ...payload, id: editItem.id });
      } else {
        await api.addGold(payload);
      }
      setItemsModalOpen(false);
      setEditItem(null);
      setForm(emptyForm());
      setDelConfirm(false);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem() {
    if (!delConfirm) {
      setDelConfirm(true);
      return;
    }
    if (!editItem) return;
    setSaving(true);
    try {
      await api.deleteGold(editItem.id);
      setItemsModalOpen(false);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  // History handlers
  function setHistoryField<K extends keyof GoldHistoryFormState>(k: K, v: GoldHistoryFormState[K]) {
    setHistoryForm(f => ({ ...f, [k]: v }));
  }

  async function saveHistory() {
    if (!historyForm.name.trim() || !historyForm.weight_g) return;
    setHistorySaving(true);
    const payload = {
      date: historyForm.date,
      type: historyForm.type,
      name: historyForm.name.trim(),
      weight_g: parseFloat(historyForm.weight_g),
      note: historyForm.note.trim(),
    };
    try {
      if (editHistory) {
        await api.updateGoldHistory({ ...payload, id: editHistory.id });
      } else {
        await api.addGoldHistory(payload);
      }
      setHistoryModalOpen(false);
      setEditHistory(null);
      setHistoryForm(emptyHistoryForm());
      setHistoryDelConfirm(false);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setHistorySaving(false);
    }
  }

  function openEditHistory(h: GoldHistoryItem) {
    setEditHistory(h);
    setHistoryForm({
      date: h.date,
      type: h.type,
      name: h.name,
      weight_g: String(h.weight_g),
      note: h.note || '',
    });
    setHistoryDelConfirm(false);
    setHistoryModalOpen(true);
  }

  async function deleteHistory() {
    if (!historyDelConfirm) {
      setHistoryDelConfirm(true);
      return;
    }
    if (!editHistory) return;
    setHistorySaving(true);
    try {
      await api.deleteGoldHistory(editHistory.id);
      setHistoryModalOpen(false);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setHistorySaving(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Tab bar */}
      <nav className="tab-bar">
        <button className={`tab-item${activeTab === 'dashboard' ? ' active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <span className="tab-icon"><LayoutDashboard size={19} /></span>
          <span>Dashboard</span>
        </button>
        <button className={`tab-item${activeTab === 'items' ? ' active' : ''}`} onClick={() => setActiveTab('items')}>
          <span className="tab-icon"><List size={19} /></span>
          <span>Items</span>
        </button>
        <button className={`tab-item${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}>
          <span className="tab-icon"><Clock size={19} /></span>
          <span>History</span>
        </button>
      </nav>

      <div className="pg">

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <>
            {/* KPI row with settings button */}
            <div style={{ marginBottom: 20 }}>
              <div className="kpis">
                <div className="card" style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
                    Total Gold
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
                    {Math.round(totalGrams)}g
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Scale size={11} />
                    {totalPavan.toFixed(3)} pavan
                  </div>
                </div>
                <div className="card" style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
                    Estimated Value
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#F59E0B' }}>
                    {INR(estimatedValue)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <TrendingUp size={11} />
                    {Math.round(personalGrams)}g @ ₹{goldRate}/g
                  </div>
                </div>
              </div>
              <button
                onClick={onOpenSettings}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Gold settings"
              >
                <SettingsIcon size={18} />
              </button>
            </div>

            {/* Breakdown by person */}
            <div className="sec" style={{ marginBottom: 20 }}>
              <div className="sec-h" style={{ marginBottom: 12 }}>By Person</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {PEOPLE.map(p => (groupedByPerson[p] ? (
                  <PersonCard key={p} person={p} items={groupedByPerson[p]} />
                ) : null))}
              </div>
            </div>

            {/* Breakdown by location */}
            <div className="sec">
              <div className="sec-h" style={{ marginBottom: 12 }}>By Location</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {LOCATIONS.map(l => (groupedByLocation[l] ? (
                  <LocationCard key={l} location={l} items={groupedByLocation[l]} />
                ) : null))}
              </div>
            </div>
          </>
        )}

        {/* ITEMS TAB */}
        {activeTab === 'items' && (
          <>
            {/* Search bar */}
            <div style={{position:'relative',marginBottom:16}}>
              <input className="form-inp" type="text" placeholder="Search name, person, location…" value={itemsSearch} onChange={e => setItemsSearch(e.target.value)} style={{paddingLeft:36,paddingRight:32,fontSize:14}} />
              <Search size={15} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--muted)',pointerEvents:'none'}} />
              {itemsSearch && (
                <button className="icon-btn" style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)'}} onClick={() => setItemsSearch('')}><X size={14} /></button>
              )}
            </div>

            {/* Loading */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '1rem 0', color: 'var(--muted)', fontSize: 14 }}>
                <Loader2 size={16} className="spin-icon" /> Loading…
              </div>
            )}

            {/* Empty state */}
            {!loading && filteredItems.length === 0 && (
              <p style={{ color: 'var(--muted)', padding: '1rem 0', fontSize: 14 }}>No items to display.</p>
            )}

            {/* Mobile cards */}
            {!loading && filteredItems.length > 0 && (
              <div className="txn-cards">
                {filteredItems.map(i => (
                  <div
                    key={i.id}
                    className="txn-card"
                    style={{
                      cursor: 'pointer',
                      borderLeft: '4px solid #F59E0B',
                    }}
                    onClick={() => openEditItem(i)}
                  >
                    <div className="txn-card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text)' }}>{i.name}</span>
                      <span className="mono" style={{ color: '#F59E0B', fontWeight: 700 }}>
                        {Math.round(i.weight_g)}g
                      </span>
                    </div>
                    <div className="txn-card-bot" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{i.pavan.toFixed(3)} pavan</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{i.person}</span>
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>📍 {i.location}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Desktop table */}
            {!loading && filteredItems.length > 0 && (
              <div className="tw txn-table">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Weight (g)</th>
                      <th>Pavan</th>
                      <th>Person</th>
                      <th>Location</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(i => (
                      <tr key={i.id}>
                        <td style={{ color: 'var(--muted)', fontSize: 11 }}>{i.id.slice(0, 8)}</td>
                        <td>{i.name}</td>
                        <td className="mono" style={{ fontWeight: 700 }}>
                          {Math.round(i.weight_g)}
                        </td>
                        <td className="mono">
                          {i.pavan.toFixed(3)}
                        </td>
                        <td>{i.person}</td>
                        <td>{i.location}</td>
                        <td>
                          <button
                            className="icon-btn"
                            onClick={() => openEditItem(i)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <>
            {/* Loading */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '1rem 0', color: 'var(--muted)', fontSize: 14 }}>
                <Loader2 size={16} className="spin-icon" /> Loading…
              </div>
            )}

            {/* Empty state */}
            {!loading && history.length === 0 && (
              <p style={{ color: 'var(--muted)', padding: '1rem 0', fontSize: 14 }}>No history entries yet.</p>
            )}

            {/* History cards */}
            {!loading && history.length > 0 && (
              <div className="txn-cards">
                {history.map(h => {
                  const isIn = h.type === 'IN';
                  const color = isIn ? '#10B981' : '#EF4444';
                  return (
                    <div
                      key={h.id}
                      className="txn-card"
                      style={{
                        borderLeft: `4px solid ${color}`,
                      }}
                    >
                      <div className="txn-card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500, color: 'var(--text)' }}>{h.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="mono" style={{ color, fontWeight: 700 }}>
                            {isIn ? '+' : '−'}{Math.round(h.weight_g)}g
                          </span>
                          <button
                            className="icon-btn"
                            onClick={() => openEditHistory(h)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => {
                              setEditHistory(h);
                              setHistoryForm({
                                date: h.date,
                                type: h.type,
                                name: h.name,
                                weight_g: String(h.weight_g),
                                note: h.note || '',
                              });
                              setHistoryDelConfirm(false);
                              setHistoryModalOpen(true);
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="txn-card-bot" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{h.date}</span>
                        <span style={{ fontSize: 10, color: isIn ? '#10B981' : '#EF4444', fontWeight: 600, textTransform: 'uppercase' }}>
                          {h.type}
                        </span>
                        {h.note && (
                          <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, width: '100%' }}>
                            {h.note}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Error message */}
        {error && (
          <p style={{ color: '#EF4444', fontSize: 13, padding: '12px 10px', marginTop: 12 }}>
            ⚠ {error}
          </p>
        )}
      </div>

      {/* FAB — context-sensitive */}
      {(activeTab === 'items' || activeTab === 'history') && (
        <button
          onClick={() => {
            if (activeTab === 'items') {
              setEditItem(null);
              setForm(emptyForm());
              setDelConfirm(false);
              setItemsModalOpen(true);
            } else {
              setHistoryForm(emptyHistoryForm());
              setHistoryModalOpen(true);
            }
          }}
          style={{
            position: 'fixed', bottom: 24, right: 20,
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--navy-dark)', color: '#fff',
            border: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,.2)',
            cursor: 'pointer', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title={activeTab === 'items' ? 'Add gold item' : 'Add history entry'}
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      {/* ITEMS MODAL */}
      {itemsModalOpen && (
        <div className="modal-bg open" onClick={ev => { if (ev.target === ev.currentTarget) setItemsModalOpen(false); }}>
          <div className="modal">
            <div className="modal-hd">
              <span className="modal-title">{editItem ? 'Edit Gold Item' : 'Add Gold Item'}</span>
              <button className="modal-close" onClick={() => setItemsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label className="form-lbl">Item Name</label>
                <input
                  className="form-inp"
                  type="text"
                  placeholder="e.g., Necklace, Bangles…"
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="form-lbl">Weight (g)</label>
                <input
                  className="form-inp mono"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.weight_g}
                  onChange={e => setField('weight_g', e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="form-lbl">Pavan (auto-calculated)</label>
                <input
                  className="form-inp mono"
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.pavan}
                  disabled
                />
              </div>
              <div className="form-row">
                <label className="form-lbl">Person</label>
                <select
                  className="form-sel"
                  value={form.person}
                  onChange={e => setField('person', e.target.value)}
                >
                  {PEOPLE.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label className="form-lbl">Location</label>
                <select
                  className="form-sel"
                  value={form.location}
                  onChange={e => setField('location', e.target.value)}
                >
                  {LOCATIONS.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-foot">
              <div className="modal-foot-l">
                {editItem && (
                  <button
                    className="btn btn-red btn-sm"
                    onClick={deleteItem}
                    disabled={saving}
                  >
                    {delConfirm ? (
                      <>
                        <AlertTriangle size={14} /> Confirm?
                      </>
                    ) : (
                      <>
                        <Trash2 size={14} /> Delete
                      </>
                    )}
                  </button>
                )}
              </div>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--border)', color: 'var(--text)' }}
                onClick={() => setItemsModalOpen(false)}
              >
                <X size={14} /> Cancel
              </button>
              <button
                className="btn btn-sm btn-green"
                onClick={saveItem}
                disabled={saving || !form.name.trim() || !form.weight_g}
              >
                {saving ? (
                  <Loader2 size={14} className="spin-icon" />
                ) : editItem ? (
                  <>
                    <Check size={14} /> Save
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Add
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {historyModalOpen && (
        <div className="modal-bg open" onClick={ev => { if (ev.target === ev.currentTarget) setHistoryModalOpen(false); }}>
          <div className="modal">
            <div className="modal-hd">
              <span className="modal-title">{editHistory ? 'Edit Gold Movement' : 'Add Gold Movement'}</span>
              <button className="modal-close" onClick={() => setHistoryModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label className="form-lbl">Date</label>
                <input
                  className="form-inp"
                  type="date"
                  value={historyForm.date}
                  onChange={e => setHistoryField('date', e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="form-lbl">Type</label>
                <select
                  className="form-sel"
                  value={historyForm.type}
                  onChange={e => setHistoryField('type', e.target.value as 'IN' | 'OUT')}
                >
                  <option value="IN">In (↓ received)</option>
                  <option value="OUT">Out (↑ given)</option>
                </select>
              </div>
              <div className="form-row">
                <label className="form-lbl">Item Name</label>
                <input
                  className="form-inp"
                  type="text"
                  placeholder="e.g., Gold received from…"
                  value={historyForm.name}
                  onChange={e => setHistoryField('name', e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="form-lbl">Weight (g)</label>
                <input
                  className="form-inp mono"
                  type="number"
                  min="0"
                  step="0.01"
                  value={historyForm.weight_g}
                  onChange={e => setHistoryField('weight_g', e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="form-lbl">Note (optional)</label>
                <input
                  className="form-inp"
                  type="text"
                  placeholder="e.g., Wedding gift, resale…"
                  value={historyForm.note}
                  onChange={e => setHistoryField('note', e.target.value)}
                />
              </div>
            </div>
            <div className="modal-foot">
              <div className="modal-foot-l">
                {editHistory && (
                  <button
                    className="btn btn-red btn-sm"
                    onClick={deleteHistory}
                    disabled={historySaving}
                  >
                    {historyDelConfirm ? (
                      <>
                        <AlertTriangle size={14} /> Confirm?
                      </>
                    ) : (
                      <>
                        <Trash2 size={14} /> Delete
                      </>
                    )}
                  </button>
                )}
              </div>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--border)', color: 'var(--text)' }}
                onClick={() => setHistoryModalOpen(false)}
              >
                <X size={14} /> Cancel
              </button>
              <button
                className="btn btn-sm btn-green"
                onClick={saveHistory}
                disabled={historySaving || !historyForm.name.trim() || !historyForm.weight_g}
              >
                {historySaving ? (
                  <Loader2 size={14} className="spin-icon" />
                ) : editHistory ? (
                  <>
                    <Check size={14} /> Save
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Add
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

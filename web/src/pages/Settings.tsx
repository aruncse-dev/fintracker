import { useState, useEffect, useCallback } from 'react';
import { Loader2, Edit2, Check } from 'lucide-react';
import { api } from '../api';

interface Setting {
  key: string;
  label: string;
  value: string;
  type: 'text' | 'number';
}

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const SETTING_FIELDS: Setting[] = [
    { key: 'goldRate', label: 'Gold Rate (₹/gram)', value: '', type: 'number' },
    { key: 'expensesSheetId', label: 'Expenses Spreadsheet ID', value: '', type: 'text' },
    { key: 'assetsSheetId', label: 'Assets Spreadsheet ID', value: '', type: 'text' },
    { key: 'loansSpreadsheetId', label: 'Loans Spreadsheet ID', value: '', type: 'text' },
  ];

  // Load settings on mount
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getSettings();
      const loaded: Record<string, string> = {};
      SETTING_FIELDS.forEach(field => {
        loaded[field.key] = String(data[field.key as keyof typeof data] || '');
      });
      setSettings(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function saveField(key: string, value: string) {
    setSaving(true);
    setError('');
    try {
      await api.saveSettings({ [key]: value });
      setSettings(prev => ({ ...prev, [key]: value }));
      setEditingKey(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(key: string) {
    setEditingKey(key);
    setEditValue(settings[key] || '');
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="pg">
        <div className="sec">
          <div className="sec-h">Configuration</div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '1rem 0', color: 'var(--muted)', fontSize: 14 }}>
              <Loader2 size={16} className="spin-icon" /> Loading…
            </div>
          )}

          {error && (
            <p style={{ color: '#EF4444', fontSize: 13, padding: '12px 10px', marginBottom: 12 }}>
              ⚠ {error}
            </p>
          )}

          {!loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {SETTING_FIELDS.map(field => (
                <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{field.label}</label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {editingKey === field.key ? (
                      <>
                        <input
                          autoFocus
                          type={field.type}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className={`form-inp ${field.type === 'text' ? 'mono' : ''}`}
                          style={{ flex: 1, maxWidth: 400 }}
                        />
                        <button
                          onClick={() => saveField(field.key, editValue)}
                          disabled={saving}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            color: 'var(--muted)',
                            padding: '4px 8px',
                            opacity: saving ? 0.5 : 1,
                            flexShrink: 0,
                          }}
                        >
                          {saving ? <Loader2 size={16} className="spin-icon" /> : <Check size={16} />}
                        </button>
                      </>
                    ) : (
                      <>
                        <input
                          type={field.type}
                          value={settings[field.key] || ''}
                          readOnly
                          className={`form-inp ${field.type === 'text' ? 'mono' : ''}`}
                          style={{ flex: 1, maxWidth: 400, cursor: 'pointer' }}
                          onClick={() => startEdit(field.key)}
                        />
                        <button
                          onClick={() => startEdit(field.key)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--muted)',
                            padding: '4px 8px',
                            flexShrink: 0,
                          }}
                        >
                          <Edit2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

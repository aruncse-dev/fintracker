import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../api';

export default function Settings() {
  const [goldRate, setGoldRate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Load settings on mount
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const settings = await api.getSettings();
      setGoldRate(String(settings.goldRate));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function save() {
    const rate = parseFloat(goldRate);
    if (isNaN(rate) || rate <= 0) {
      setError('Gold rate must be a positive number');
      return;
    }

    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api.saveSettings({ goldRate: rate });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="pg">
        {/* Gold Settings Section */}
        <div className="sec">
          <div className="sec-h">Gold Settings</div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '1rem 0', color: 'var(--muted)', fontSize: 14 }}>
              <Loader2 size={16} className="spin-icon" /> Loading…
            </div>
          )}

          {!loading && (
            <>
              <div className="form-row">
                <label className="form-lbl">Gold Rate (₹/gram)</label>
                <input
                  className="form-inp mono"
                  type="number"
                  min="1"
                  step="0.01"
                  value={goldRate}
                  onChange={e => setGoldRate(e.target.value)}
                />
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                  Used to calculate estimated gold value
                </div>
              </div>

              {error && (
                <p style={{ color: '#EF4444', fontSize: 13, padding: '12px 10px', marginTop: 12 }}>
                  ⚠ {error}
                </p>
              )}

              <div style={{ marginTop: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="btn btn-sm btn-green"
                  onClick={save}
                  disabled={saving || !goldRate}
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="spin-icon" /> Saving…
                    </>
                  ) : (
                    'Save'
                  )}
                </button>

                {saved && (
                  <span style={{ fontSize: 13, color: '#10B981', fontWeight: 600 }}>
                    ✓ Saved
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Future-Ready Sections */}
        <div className="sec">
          <div className="sec-h">Display</div>
          <p style={{ color: 'var(--muted)', padding: '1rem 0', fontSize: 14 }}>
            Currency and other display preferences coming soon.
          </p>
        </div>

        <div className="sec">
          <div className="sec-h">Preferences</div>
          <p style={{ color: 'var(--muted)', padding: '1rem 0', fontSize: 14 }}>
            Additional preferences and options will be added here.
          </p>
        </div>
      </div>
    </div>
  );
}

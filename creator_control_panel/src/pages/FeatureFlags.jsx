import { useState, useEffect } from 'react';
import { Plus, Save, RefreshCcw, Loader2, Trash2 } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import toast from 'react-hot-toast';

export default function FeatureFlags() {
    const [flags, setFlags] = useState([]);
    const [studios, setStudios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newFlag, setNewFlag] = useState({ key: '', defaultValue: false, description: '' });
    const [showNew, setShowNew] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [flagRes, studioRes] = await Promise.all([
                httpsCallable(functions, 'setup-listFeatureFlags')({}),
                httpsCallable(functions, 'setup-getStudiosWithStats')({}),
            ]);
            setFlags(flagRes.data?.flags || []);
            setStudios((studioRes.data?.studios || []).slice(0, 30)); // cap for matrix
        } catch (err) {
            toast.error('Veriler yüklenemedi');
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateFlag() {
        if (!newFlag.key) { toast.error('Flag key gerekli'); return; }
        setSaving(true);
        try {
            await httpsCallable(functions, 'setup-setFeatureFlag')({
                key: newFlag.key,
                defaultValue: newFlag.defaultValue,
                description: newFlag.description,
            });
            toast.success('Flag oluşturuldu');
            setShowNew(false);
            setNewFlag({ key: '', defaultValue: false, description: '' });
            await loadData();
        } catch (err) {
            toast.error(err.message || 'Hata');
        } finally {
            setSaving(false);
        }
    }

    async function toggleOverride(studioId, flagKey, currentValue) {
        // Determine new value (toggle boolean or set override)
        const newValue = typeof currentValue === 'boolean' ? !currentValue : true;
        try {
            await httpsCallable(functions, 'setup-setStudioFlagOverride')({ studioId, key: flagKey, value: newValue });
            toast.success('Override güncellendi');
            await loadData();
        } catch (err) {
            toast.error(err.message || 'Hata');
        }
    }

    async function deleteOverride(studioId, flagKey) {
        try {
            await httpsCallable(functions, 'setup-deleteStudioFlagOverride')({ studioId, key: flagKey });
            toast.success('Override kaldırıldı');
            await loadData();
        } catch (err) {
            toast.error(err.message || 'Hata');
        }
    }

    async function toggleDefault(flag) {
        try {
            await httpsCallable(functions, 'setup-setFeatureFlag')({
                key: flag.key,
                defaultValue: !flag.defaultValue,
                description: flag.description,
            });
            toast.success('Default güncellendi');
            await loadData();
        } catch (err) {
            toast.error(err.message || 'Hata');
        }
    }

    if (loading) {
        return <div style={{ padding: '64px', textAlign: 'center' }}><Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} /></div>;
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Feature Flags</h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary" onClick={loadData}><RefreshCcw size={14} /></button>
                    <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> Yeni Flag</button>
                </div>
            </div>

            {showNew && (
                <div className="card" style={{ marginBottom: '20px' }}>
                    <div className="card-header">
                        <h2 className="card-title">Yeni Feature Flag</h2>
                        <button className="btn btn-secondary" onClick={() => setShowNew(false)}>Kapat</button>
                    </div>
                    <div style={{ padding: '0 20px 20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <input className="input" style={{ flex: '1 1 160px' }} placeholder="Flag Key (örn: enableWhatsapp)" value={newFlag.key} onChange={e => setNewFlag(p => ({ ...p, key: e.target.value }))} />
                        <input className="input" style={{ flex: '2 1 200px' }} placeholder="Açıklama" value={newFlag.description} onChange={e => setNewFlag(p => ({ ...p, description: e.target.value }))} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                            <input type="checkbox" checked={!!newFlag.defaultValue} onChange={e => setNewFlag(p => ({ ...p, defaultValue: e.target.checked }))} />
                            Varsayılan Açık
                        </label>
                        <button className="btn btn-primary" onClick={handleCreateFlag} disabled={saving}>
                            {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                            Kaydet
                        </button>
                    </div>
                </div>
            )}

            {/* Flags list */}
            <div className="card" style={{ marginBottom: '20px' }}>
                <div className="card-header"><h2 className="card-title">Tüm Flag'ler</h2></div>
                <table className="table">
                    <thead>
                        <tr>
                            <th>Key</th>
                            <th>Açıklama</th>
                            <th>Varsayılan</th>
                            <th>Override Sayısı</th>
                        </tr>
                    </thead>
                    <tbody>
                        {flags.length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Flag yok</td></tr>
                        ) : flags.map(f => (
                            <tr key={f.key}>
                                <td><code style={{ fontSize: '12px' }}>{f.key}</code></td>
                                <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{f.description || '-'}</td>
                                <td>
                                    <button
                                        style={{
                                            background: f.defaultValue ? '#22c55e' : '#94a3b8',
                                            color: '#fff', border: 'none', borderRadius: '12px',
                                            padding: '2px 12px', cursor: 'pointer', fontSize: '12px'
                                        }}
                                        onClick={() => toggleDefault(f)}>
                                        {f.defaultValue ? 'Açık' : 'Kapalı'}
                                    </button>
                                </td>
                                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    {Object.keys(f.overrides || {}).length} stüdyo
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Override matrix (compact, first 30 studios × all flags) */}
            {flags.length > 0 && studios.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Stüdyo Override Matrisi</h2>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>İlk 30 stüdyo gösteriliyor</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table" style={{ fontSize: '12px' }}>
                            <thead>
                                <tr>
                                    <th>Stüdyo</th>
                                    {flags.map(f => <th key={f.key} style={{ whiteSpace: 'nowrap' }}>{f.key}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {studios.map(s => (
                                    <tr key={s.id}>
                                        <td style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{s.name || s.info?.name || s.id}</td>
                                        {flags.map(f => {
                                            const hasOverride = f.overrides && f.overrides[s.id] !== undefined;
                                            const value = hasOverride ? f.overrides[s.id] : f.defaultValue;
                                            return (
                                                <td key={f.key} style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                        <button
                                                            style={{
                                                                background: value ? '#22c55e' : '#94a3b8',
                                                                color: '#fff', border: hasOverride ? '2px solid #f59e0b' : 'none',
                                                                borderRadius: '10px', padding: '1px 8px', cursor: 'pointer', fontSize: '11px'
                                                            }}
                                                            title={hasOverride ? 'Override var (turuncu çerçeve)' : 'Varsayılan kullanılıyor'}
                                                            onClick={() => toggleOverride(s.id, f.key, value)}>
                                                            {value ? 'A' : 'K'}
                                                        </button>
                                                        {hasOverride && (
                                                            <button
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0 2px' }}
                                                                title="Override kaldır"
                                                                onClick={() => deleteOverride(s.id, f.key)}>
                                                                <Trash2 size={11} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ padding: '8px 20px', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)' }}>
                        A = Açık, K = Kapalı. Turuncu çerçeve = override aktif. Varsayılana dönmek için çöp kutusuna tıklayın.
                    </div>
                </div>
            )}
        </div>
    );
}

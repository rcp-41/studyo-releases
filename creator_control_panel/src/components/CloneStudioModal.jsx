import { useState } from 'react';
import { Copy, X, Loader2 } from 'lucide-react';
import { creatorApi } from '../services/creatorApi';
import toast from 'react-hot-toast';

const CLONE_COLS = [
    { key: 'bot', label: 'Bot Konfigürasyonu' },
    { key: 'packages', label: 'Paketler' },
    { key: 'shootTypes', label: 'Çekim Türleri' },
    { key: 'settings', label: 'Ayarlar & Diğer' },
];

export default function CloneStudioModal({ studio, organizations = [], onClose, onSuccess }) {
    const [newName, setNewName] = useState(studio.info?.name ? studio.info.name + ' (Kopya)' : '');
    const [targetOrgId, setTargetOrgId] = useState(studio.organizationId || '');
    const [options, setOptions] = useState({ bot: true, packages: true, shootTypes: true, settings: true });
    const [loading, setLoading] = useState(false);

    const toggle = (key) => setOptions(prev => ({ ...prev, [key]: !prev[key] }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return toast.error('Yeni stüdyo adı giriniz');
        setLoading(true);
        try {
            const result = await creatorApi.cloneStudio(
                studio.organizationId,
                studio.id,
                newName.trim(),
                targetOrgId || studio.organizationId,
                options
            );
            toast.success(`Stüdyo klonlandı: ${result.newStudioId}`);
            onSuccess?.();
            onClose();
        } catch (err) {
            // handleApiError already toasts
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 12, padding: 28, width: 440, maxWidth: '95vw' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Copy size={18} color="#818cf8" />
                        <span style={{ fontWeight: 700, fontSize: 16, color: '#e2e8f0' }}>Stüdyo Klonla</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
                </div>

                <div style={{ marginBottom: 12, color: '#94a3b8', fontSize: 13 }}>
                    Kaynak: <strong style={{ color: '#c7d2fe' }}>{studio.info?.name || studio.id}</strong>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5 }}>Yeni Stüdyo Adı *</label>
                        <input
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            required
                            style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' }}
                        />
                    </div>

                    {organizations.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5 }}>Hedef Organizasyon</label>
                            <select
                                value={targetOrgId}
                                onChange={e => setTargetOrgId(e.target.value)}
                                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 14 }}
                            >
                                {organizations.map(o => (
                                    <option key={o.id} value={o.id}>{o.name || o.id}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div style={{ marginBottom: 18 }}>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>Kopyalanacak Koleksiyonlar</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {CLONE_COLS.map(col => (
                                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#cbd5e1', fontSize: 13 }}>
                                    <input type="checkbox" checked={options[col.key]} onChange={() => toggle(col.key)} />
                                    {col.label}
                                </label>
                            ))}
                        </div>
                        <p style={{ color: '#475569', fontSize: 11, marginTop: 6 }}>Müşteri / randevu / fotoğraf verisi dahil edilmez.</p>
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} disabled={loading}
                            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #334155', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
                            Vazgec
                        </button>
                        <button type="submit" disabled={loading}
                            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: loading ? 'wait' : 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                            Klonla
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

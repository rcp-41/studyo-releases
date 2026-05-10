import { useState } from 'react';
import { ArrowRightLeft, X, Loader2 } from 'lucide-react';
import { creatorApi } from '../services/creatorApi';
import toast from 'react-hot-toast';

export default function MoveStudioModal({ studio, organizations = [], onClose, onSuccess }) {
    const [toOrgId, setToOrgId] = useState('');
    const [confirm, setConfirm] = useState(false);
    const [loading, setLoading] = useState(false);

    const otherOrgs = organizations.filter(o => o.id !== studio.organizationId);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!toOrgId) return toast.error('Hedef organizasyon seciniz');
        if (!confirm) return toast.error('Onay kutusunu isaretleyin');
        setLoading(true);
        try {
            await creatorApi.moveStudio(studio.id, studio.organizationId, toOrgId);
            toast.success('Stüdyo basariyla tasindi');
            onSuccess?.();
            onClose();
        } catch (err) {
            // toasted by handleApiError
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 12, padding: 28, width: 420, maxWidth: '95vw' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ArrowRightLeft size={18} color="#f59e0b" />
                        <span style={{ fontWeight: 700, fontSize: 16, color: '#e2e8f0' }}>Organizasyon Degistir</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
                </div>

                <div style={{ marginBottom: 14, color: '#94a3b8', fontSize: 13 }}>
                    Stüdyo: <strong style={{ color: '#fcd34d' }}>{studio.info?.name || studio.id}</strong><br />
                    Mevcut org: <span style={{ color: '#94a3b8' }}>{studio.organizationName || studio.organizationId}</span>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5 }}>Hedef Organizasyon *</label>
                        {otherOrgs.length === 0 ? (
                            <p style={{ color: '#ef4444', fontSize: 13 }}>Baska organizasyon bulunamadi.</p>
                        ) : (
                            <select value={toOrgId} onChange={e => setToOrgId(e.target.value)} required
                                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 14 }}>
                                <option value="">Secin...</option>
                                {otherOrgs.map(o => <option key={o.id} value={o.id}>{o.name || o.id}</option>)}
                            </select>
                        )}
                    </div>

                    <div style={{ background: '#7c2d12', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#fca5a5' }}>
                        Bu islem stüdyoyu ve tüm alt koleksiyonlarini (maks 1000 dok/koleksiyon) tasindirir. Geri alınamaz.
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#cbd5e1', fontSize: 13, marginBottom: 18 }}>
                        <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} />
                        Bu islemi onayliyorum, geri alinamayacagini anliyorum.
                    </label>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} disabled={loading}
                            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #334155', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
                            Vazgec
                        </button>
                        <button type="submit" disabled={loading || otherOrgs.length === 0}
                            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#d97706', color: '#fff', cursor: loading ? 'wait' : 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {loading ? <Loader2 size={14} /> : <ArrowRightLeft size={14} />}
                            Taşı
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

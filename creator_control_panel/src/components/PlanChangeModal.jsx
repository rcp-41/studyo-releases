import { useState } from 'react';
import { X, Loader2, CheckCircle } from 'lucide-react';
import { creatorApi } from '../services/creatorApi';
import toast from 'react-hot-toast';

const TIERS = [
    {
        id: 'basic',
        label: 'Basic',
        color: '#6b7280',
        badge: 'bg-gray',
        desc: '5 kullanıcı · 5 GB depolama',
        features: ['Temel arşiv', 'Randevu yönetimi']
    },
    {
        id: 'pro',
        label: 'Pro',
        color: '#6366f1',
        badge: 'bg-indigo',
        desc: '20 kullanıcı · 20 GB depolama',
        features: ['WhatsApp bot', 'Analitik', 'Raporlar']
    },
    {
        id: 'enterprise',
        label: 'Enterprise',
        color: '#f59e0b',
        badge: 'bg-amber',
        desc: '100 kullanıcı · 100 GB depolama',
        features: ['Sesli bot', 'Öncelikli destek', 'Tüm özellikler']
    }
];

export function PlanBadge({ tier }) {
    const t = TIERS.find(x => x.id === tier);
    if (!t) return null;
    return (
        <span style={{
            fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
            background: t.color + '22', color: t.color, border: `1px solid ${t.color}44`
        }}>
            {t.label}
        </span>
    );
}

export default function PlanChangeModal({ studio, onClose, onSuccess }) {
    const currentTier = studio.plan?.tier || 'basic';
    const [selectedTier, setSelectedTier] = useState(currentTier);
    const [confirming, setConfirming] = useState(false);
    const [saving, setSaving] = useState(false);

    async function handleConfirm() {
        if (selectedTier === currentTier) {
            toast('Seçili plan zaten mevcut plan.');
            return;
        }
        setSaving(true);
        try {
            await creatorApi.changeStudioPlan(studio.organizationId, studio.id, selectedTier);
            toast.success(`Plan ${selectedTier} olarak değiştirildi!`);
            onSuccess?.();
            onClose();
        } catch (err) {
            toast.error('Plan değiştirilemedi: ' + err.message);
        } finally {
            setSaving(false);
            setConfirming(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                <div className="modal-header">
                    <h2>Plan Değiştir — {studio.info?.name}</h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body">
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                        Mevcut plan: <PlanBadge tier={currentTier} />
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {TIERS.map(tier => (
                            <label key={tier.id} style={{
                                display: 'flex', alignItems: 'flex-start', gap: '12px',
                                padding: '12px 14px', borderRadius: '8px', cursor: 'pointer',
                                border: `2px solid ${selectedTier === tier.id ? tier.color : 'var(--border-color)'}`,
                                background: selectedTier === tier.id ? tier.color + '11' : 'var(--bg-secondary)',
                                transition: 'all 0.15s'
                            }}>
                                <input type="radio" name="tier" value={tier.id}
                                    checked={selectedTier === tier.id}
                                    onChange={() => setSelectedTier(tier.id)}
                                    style={{ marginTop: '3px' }}
                                />
                                <div>
                                    <div style={{ fontWeight: 600, color: tier.color, marginBottom: '2px' }}>
                                        {tier.label}
                                        {currentTier === tier.id && (
                                            <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
                                                (mevcut)
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{tier.desc}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        {tier.features.map((f, i) => (
                                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginRight: '10px' }}>
                                                <CheckCircle size={10} color={tier.color} /> {f}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>

                    {confirming && selectedTier !== currentTier && (
                        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', fontSize: '13px', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <strong>Onay:</strong> {studio.info?.name} stüdyosunun planı <strong>{currentTier}</strong> yerine <strong>{selectedTier}</strong> olarak değiştirilecek.
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Vazgeç</button>
                    {!confirming ? (
                        <button className="btn btn-primary" disabled={selectedTier === currentTier}
                            onClick={() => setConfirming(true)}>
                            Değiştir
                        </button>
                    ) : (
                        <button className="btn btn-primary" onClick={handleConfirm} disabled={saving}>
                            {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Kaydediliyor...</> : 'Onayla ve Kaydet'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

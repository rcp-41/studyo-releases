import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { creatorApi } from '../services/creatorApi';
import toast from 'react-hot-toast';

const QUICK_MONTHS = [
    { label: '1 Ay', months: 1 },
    { label: '3 Ay', months: 3 },
    { label: '6 Ay', months: 6 },
    { label: '12 Ay', months: 12 }
];

function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}

function toInputDate(date) {
    return date.toISOString().slice(0, 10);
}

export default function SubscriptionModal({ studio, onClose, onSuccess }) {
    const existingExpiry = studio.subscription?.expiresAt
        ? new Date(studio.subscription.expiresAt)
        : new Date();

    const [expiresAt, setExpiresAt] = useState(toInputDate(addMonths(existingExpiry > new Date() ? existingExpiry : new Date(), 1)));
    const [saving, setSaving] = useState(false);

    function setQuick(months) {
        const base = existingExpiry > new Date() ? existingExpiry : new Date();
        setExpiresAt(toInputDate(addMonths(base, months)));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!expiresAt) return;
        setSaving(true);
        try {
            await creatorApi.updateSubscription(studio.organizationId, studio.id, expiresAt);
            toast.success('Abonelik güncellendi!');
            onSuccess?.();
            onClose();
        } catch (err) {
            toast.error('Güncelleme başarısız: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    const currentStatus = studio.subscription?.status;
    const currentExpiry = studio.subscription?.expiresAt;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
                <div className="modal-header">
                    <h2>Aboneliği Güncelle — {studio.info?.name}</h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {currentExpiry && (
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                Mevcut bitiş: <strong>{new Date(currentExpiry).toLocaleDateString('tr-TR')}</strong>
                                {currentStatus && <span style={{ marginLeft: '8px', fontSize: '11px' }}>({currentStatus})</span>}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            {QUICK_MONTHS.map(q => (
                                <button key={q.months} type="button" className="btn btn-secondary btn-sm"
                                    onClick={() => setQuick(q.months)}>
                                    +{q.label}
                                </button>
                            ))}
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Bitiş Tarihi *</label>
                            <input
                                type="date" className="form-input" required
                                min={toInputDate(new Date())}
                                value={expiresAt}
                                onChange={e => setExpiresAt(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Vazgeç</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Kaydediliyor...</> : 'Kaydet'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

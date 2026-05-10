import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { creatorApi } from '../services/creatorApi';
import toast from 'react-hot-toast';

export default function CouponApplyModal({ studio, onClose, onSuccess }) {
    const [code, setCode] = useState('');
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState(null);

    async function handleApply(e) {
        e.preventDefault();
        if (!code.trim()) return;
        setSaving(true);
        setResult(null);
        try {
            const res = await creatorApi.redeemCoupon(studio.organizationId, studio.id, code.trim());
            setResult(res);
            toast.success(res.message || 'Kupon uygulandı!');
            onSuccess?.();
        } catch (err) {
            toast.error('Kupon uygulanamadı: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div className="modal-header">
                    <h2>Kupon Uygula — {studio.info?.name}</h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <form onSubmit={handleApply}>
                    <div className="modal-body">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Kupon Kodu</label>
                            <input
                                type="text" className="form-input" required
                                placeholder="KUPON123"
                                value={code}
                                onChange={e => setCode(e.target.value.toUpperCase())}
                                style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
                            />
                        </div>
                        {result && (
                            <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(34,197,94,0.1)', borderRadius: '6px', fontSize: '13px', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                                {result.message}
                                {result.newExpiresAt && (
                                    <div style={{ fontSize: '11px', marginTop: '4px' }}>
                                        Yeni bitiş: {new Date(result.newExpiresAt).toLocaleDateString('tr-TR')}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Kapat</button>
                        <button type="submit" className="btn btn-primary" disabled={saving || !code.trim()}>
                            {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Uygulanıyor...</> : 'Uygula'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

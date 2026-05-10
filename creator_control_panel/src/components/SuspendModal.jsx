import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { creatorApi } from '../services/creatorApi';
import toast from 'react-hot-toast';

export default function SuspendModal({ studio, onClose, onSuccess }) {
    const [reason, setReason] = useState('');
    const [reactivateAfterDays, setReactivateAfterDays] = useState('');
    const [saving, setSaving] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!reason.trim()) {
            toast.error('Askıya alma nedeni gerekli');
            return;
        }
        setSaving(true);
        try {
            await creatorApi.suspendStudioWithReason(
                studio.organizationId,
                studio.id,
                reason.trim(),
                reactivateAfterDays ? parseInt(reactivateAfterDays) : undefined
            );
            toast.success('Stüdyo askıya alındı');
            onSuccess?.();
            onClose();
        } catch (err) {
            toast.error('Askıya alma başarısız: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
                <div className="modal-header">
                    <h2>Stüdyoyu Askıya Al — {studio.info?.name}</h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Askıya Alma Nedeni *</label>
                            <textarea
                                className="form-input"
                                rows={3}
                                required
                                placeholder="Örn: Ödeme gecikti, kötüye kullanım tespiti..."
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                style={{ resize: 'vertical' }}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">
                                Otomatik Aktifleştirme (gün)
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                    (Boş bırakılırsa otomatik açılmaz)
                                </span>
                            </label>
                            <input
                                type="number" min="1" max="365" className="form-input"
                                placeholder="Örn: 7 (7 gün sonra otomatik aç)"
                                value={reactivateAfterDays}
                                onChange={e => setReactivateAfterDays(e.target.value)}
                            />
                        </div>

                        {reactivateAfterDays && parseInt(reactivateAfterDays) > 0 && (
                            <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: '6px', fontSize: '12px', color: 'var(--primary)' }}>
                                Stüdyo {reactivateAfterDays} gün sonra ({new Date(Date.now() + parseInt(reactivateAfterDays) * 86400000).toLocaleDateString('tr-TR')}) otomatik aktifleştirilecek.
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Vazgeç</button>
                        <button type="submit" className="btn btn-danger" disabled={saving || !reason.trim()}>
                            {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Askıya Alınıyor...</> : 'Askıya Al'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { X, KeyRound, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { creatorApi } from '../services/creatorApi';
import toast from 'react-hot-toast';

function formatRemaining(expiresAt) {
    if (!expiresAt) return null;
    const d = expiresAt?.toDate ? expiresAt.toDate() : new Date(expiresAt);
    const diffMs = d.getTime() - Date.now();
    if (diffMs <= 0) return 'Süresi doldu';
    const diffMin = Math.ceil(diffMs / 60000);
    if (diffMin >= 60) return `${Math.floor(diffMin / 60)} saat ${diffMin % 60} dk`;
    return `${diffMin} dakika`;
}

export default function AppCheckOverrideModal({ studio, onClose }) {
    const [override, setOverride] = useState(undefined); // undefined = loading
    const [duration, setDuration] = useState(30);
    const [reason, setReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Real-time Firestore listener
    useEffect(() => {
        const ref = doc(db, 'appCheckOverrides', studio.id);
        const unsub = onSnapshot(ref, snap => {
            if (snap.exists()) {
                setOverride(snap.data());
            } else {
                setOverride(null);
            }
        }, err => {
            console.error('AppCheck override snapshot error:', err);
            setOverride(null);
        });
        return () => unsub();
    }, [studio.id]);

    async function handleGrant() {
        if (!reason.trim()) {
            toast.error('Neden alanı zorunludur');
            return;
        }
        if (duration < 1 || duration > 480) {
            toast.error('Süre 1-480 dakika arasında olmalı');
            return;
        }
        setActionLoading(true);
        try {
            await creatorApi.grantAppCheckOverride(studio.id, duration, reason.trim());
            toast.success('AppCheck geçit açıldı');
            setReason('');
        } catch (err) {
            toast.error('Hata: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    }

    async function handleRevoke() {
        setActionLoading(true);
        try {
            await creatorApi.revokeAppCheckOverride(studio.id);
            toast.success('AppCheck geçit kapatıldı');
        } catch (err) {
            toast.error('Hata: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    }

    const isLoading = override === undefined;
    const hasOverride = override !== null && override !== undefined && !isLoading;
    const showWarning = duration > 60;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <KeyRound size={18} /> AppCheck Destek Geçidi — {studio.info?.name}
                    </h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body">
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
                        </div>
                    ) : hasOverride ? (
                        /* Active override info */
                        <div>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
                                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                                borderRadius: '8px', marginBottom: '16px'
                            }}>
                                <CheckCircle size={18} style={{ color: '#22c55e', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#22c55e' }}>Aktif Geçit</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        Kalan süre: <strong>{formatRemaining(override.expiresAt)}</strong>
                                    </div>
                                </div>
                            </div>
                            <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div><span style={{ color: 'var(--text-muted)' }}>Açan:</span> {override.grantedBy || '—'}</div>
                                <div><span style={{ color: 'var(--text-muted)' }}>Neden:</span> {override.reason || '—'}</div>
                                <div><span style={{ color: 'var(--text-muted)' }}>Süre:</span> {override.durationMinutes} dakika</div>
                            </div>
                        </div>
                    ) : (
                        /* Grant form */
                        <div>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                AppCheck doğrulaması geçici olarak devre dışı bırakılır. Yalnızca destek amacıyla kullanın.
                            </p>

                            {showWarning && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                                    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                                    borderRadius: '6px', marginBottom: '14px', fontSize: '12px', color: '#f59e0b'
                                }}>
                                    <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                                    60 dakikadan uzun geçit açmak güvenlik riski oluşturabilir.
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Süre (dakika) — min: 1, maks: 480</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min={1}
                                    max={480}
                                    value={duration}
                                    onChange={e => setDuration(parseInt(e.target.value) || 1)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Neden *</label>
                                <textarea
                                    className="form-input"
                                    rows={3}
                                    placeholder="Örn: Müşteri uygulamayı açamıyor, AppCheck token sorunu"
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Kapat</button>
                    {!isLoading && (
                        hasOverride ? (
                            <button
                                className="btn btn-danger"
                                onClick={handleRevoke}
                                disabled={actionLoading}
                            >
                                {actionLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <KeyRound size={14} />}
                                Geçidi Kapat
                            </button>
                        ) : (
                            <button
                                className="btn btn-primary"
                                onClick={handleGrant}
                                disabled={actionLoading || !reason.trim()}
                            >
                                {actionLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <KeyRound size={14} />}
                                Geçit Aç
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

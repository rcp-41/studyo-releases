import { useState } from 'react';
import { X, Monitor, Shield, ShieldOff, Loader2 } from 'lucide-react';
import { creatorApi } from '../services/creatorApi';
import toast from 'react-hot-toast';

// Status badge for device
function DeviceStatusBadge({ status }) {
    const map = {
        active:  { label: 'Aktif',   color: '#22c55e' },
        pending: { label: 'Bekliyor', color: '#f59e0b' },
        blocked: { label: 'Bloklu',  color: '#ef4444' },
    };
    const s = map[status] || { label: status || '?', color: '#9ca3af' };
    return (
        <span style={{
            fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
            background: s.color + '18', color: s.color, border: `1px solid ${s.color}33`
        }}>
            {s.label}
        </span>
    );
}

// Confirm reason modal
function ConfirmBlockModal({ device, onConfirm, onCancel }) {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleConfirm() {
        if (!reason.trim()) {
            toast.error('Blok sebebi zorunludur');
            return;
        }
        setLoading(true);
        await onConfirm(reason.trim());
        setLoading(false);
    }

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 style={{ fontSize: '16px' }}>Cihazı Kalıcı Olarak Blokla</h2>
                    <button className="modal-close" onClick={onCancel}><X size={18} /></button>
                </div>
                <div className="modal-body">
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                        HWID: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{device.deviceId}</strong>
                    </p>
                    <div className="form-group">
                        <label className="form-label">Blok Sebebi *</label>
                        <textarea
                            className="form-input"
                            rows={3}
                            placeholder="Örn: Yetkisiz kullanım tespiti"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            style={{ resize: 'vertical' }}
                        />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onCancel}>Vazgeç</button>
                    <button
                        className="btn btn-danger"
                        onClick={handleConfirm}
                        disabled={loading || !reason.trim()}
                    >
                        {loading ? <Loader2 size={14} className="spin" /> : <Shield size={14} />}
                        Kalıcı Blokla
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function DevicesModal({ studio, devices, loading, onClose, onRefresh }) {
    const [blockTarget, setBlockTarget] = useState(null);
    const [actionLoading, setActionLoading] = useState({});

    async function handleBlock(device, reason) {
        setActionLoading(p => ({ ...p, [device.deviceId]: true }));
        try {
            await creatorApi.blockDevice(device.deviceId, reason, studio.organizationId, studio.id);
            toast.success('Cihaz bloklandı');
            setBlockTarget(null);
            onRefresh();
        } catch (err) {
            toast.error('Blok hatası: ' + err.message);
        } finally {
            setActionLoading(p => ({ ...p, [device.deviceId]: false }));
        }
    }

    async function handleUnblock(device) {
        setActionLoading(p => ({ ...p, [device.deviceId]: true }));
        try {
            await creatorApi.unblockDevice(device.deviceId, studio.organizationId, studio.id);
            toast.success('Blok kaldırıldı');
            onRefresh();
        } catch (err) {
            toast.error('Blok kaldırma hatası: ' + err.message);
        } finally {
            setActionLoading(p => ({ ...p, [device.deviceId]: false }));
        }
    }

    function formatDate(val) {
        if (!val) return '—';
        const d = val?.toDate ? val.toDate() : new Date(val);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleString('tr-TR');
    }

    return (
        <>
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Monitor size={18} /> Cihazlar — {studio.info?.name}
                        </h2>
                        <button className="modal-close" onClick={onClose}><X size={20} /></button>
                    </div>
                    <div className="modal-body" style={{ padding: 0 }}>
                        {loading ? (
                            <div style={{ padding: '40px', textAlign: 'center' }}>
                                <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
                            </div>
                        ) : devices.length === 0 ? (
                            <p style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Bu stüdyoya kayıtlı cihaz yok.
                            </p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>HWID / Cihaz ID</th>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Kayıt Tarihi</th>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Durum</th>
                                        <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {devices.map(device => (
                                        <tr key={device.deviceId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '12px' }}>
                                                {device.deviceId}
                                            </td>
                                            <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>
                                                {formatDate(device.registeredAt)}
                                            </td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <DeviceStatusBadge status={device.status} />
                                            </td>
                                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                                {device.status === 'blocked' ? (
                                                    <button
                                                        className="btn btn-sm"
                                                        style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
                                                        disabled={actionLoading[device.deviceId]}
                                                        onClick={() => handleUnblock(device)}
                                                    >
                                                        {actionLoading[device.deviceId]
                                                            ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                                            : <ShieldOff size={12} />}
                                                        Bloku Kaldır
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="btn btn-sm"
                                                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                                                        disabled={actionLoading[device.deviceId]}
                                                        onClick={() => setBlockTarget(device)}
                                                    >
                                                        {actionLoading[device.deviceId]
                                                            ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                                            : <Shield size={12} />}
                                                        Kalıcı Blok
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={onClose}>Kapat</button>
                    </div>
                </div>
            </div>

            {blockTarget && (
                <ConfirmBlockModal
                    device={blockTarget}
                    onConfirm={(reason) => handleBlock(blockTarget, reason)}
                    onCancel={() => setBlockTarget(null)}
                />
            )}
        </>
    );
}

import { useState, useEffect } from 'react';
import { X, History, Download, Loader2 } from 'lucide-react';
import { creatorApi } from '../services/creatorApi';
import toast from 'react-hot-toast';

function formatSize(bytes) {
    if (!bytes) return '—';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
}

function formatRelativeTime(val) {
    if (!val) return '—';
    const d = val?.toDate ? val.toDate() : new Date(val);
    if (isNaN(d.getTime())) return '—';
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Az önce';
    if (diffMin < 60) return `${diffMin} dk önce`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} saat önce`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 30) return `${diffD} gün önce`;
    return d.toLocaleDateString('tr-TR');
}

export default function BuildHistoryModal({ studio, onClose }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const result = await creatorApi.getBuildHistory(studio.id);
                setHistory(result?.builds || result || []);
            } catch (err) {
                toast.error('Build geçmişi yüklenemedi: ' + err.message);
                setHistory([]);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [studio.id]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <History size={18} /> Build Geçmişi — {studio.info?.name}
                    </h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body" style={{ padding: 0 }}>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>
                            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
                        </div>
                    ) : history.length === 0 ? (
                        <p style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Henüz build yok.
                        </p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Versiyon</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Tarih</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Boyut</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Oluşturan</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>İndir</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((build, idx) => (
                                    <tr key={build.id || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>
                                            {build.version || '—'}
                                        </td>
                                        <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>
                                            {formatRelativeTime(build.builtAt)}
                                        </td>
                                        <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>
                                            {formatSize(build.fileSize)}
                                        </td>
                                        <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>
                                            {build.builtBy || '—'}
                                        </td>
                                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                            {build.downloadUrl ? (
                                                <a
                                                    href={build.downloadUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-sm"
                                                    style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    <Download size={12} /> İndir
                                                </a>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
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
    );
}

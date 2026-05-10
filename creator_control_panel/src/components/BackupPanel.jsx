import { useState, useEffect } from 'react';
import { Database, Download, RefreshCw, Loader2, HardDrive } from 'lucide-react';
import { creatorApi } from '../services/creatorApi';
import toast from 'react-hot-toast';

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let v = bytes;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(1)} ${units[i]}`;
}

export default function BackupPanel({ studio }) {
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [storage, setStorage] = useState(null);
    const [storageLoading, setStorageLoading] = useState(false);

    const loadBackups = async () => {
        setLoading(true);
        try {
            const result = await creatorApi.listBackups(studio.id);
            setBackups(result?.backups || []);
        } catch (err) {
            toast.error('Yedekler yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const createBackup = async () => {
        setCreating(true);
        try {
            const result = await creatorApi.createBackup(studio.organizationId, studio.id);
            toast.success('Yedek alindi');
            await loadBackups();
        } catch (err) {
            // toasted
        } finally {
            setCreating(false);
        }
    };

    const loadStorageUsage = async () => {
        setStorageLoading(true);
        try {
            const result = await creatorApi.getStudioStorageUsage(studio.organizationId, studio.id);
            setStorage(result);
        } catch (err) {
            toast.error('Depolama bilgisi alinamadi');
        } finally {
            setStorageLoading(false);
        }
    };

    useEffect(() => {
        loadBackups();
        loadStorageUsage();
    }, [studio.id]);

    return (
        <div style={{ padding: '16px 0' }}>
            {/* Storage Usage */}
            <div style={{ background: '#0f172a', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <HardDrive size={16} color="#38bdf8" />
                        <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>Depolama Kullanimi</span>
                    </div>
                    <button onClick={loadStorageUsage} disabled={storageLoading}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <RefreshCw size={14} className={storageLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
                {storageLoading ? (
                    <div style={{ color: '#64748b', fontSize: 13 }}>Hesaplaniyor...</div>
                ) : storage ? (
                    <div>
                        <div style={{ color: '#38bdf8', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{formatBytes(storage.bytes)}</div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>{storage.fileCount} dosya {storage.fromCache ? '(önbellekten)' : '(canli)'}</div>
                        {storage.top10Paths?.length > 0 && (
                            <div style={{ marginTop: 10 }}>
                                <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 5 }}>En büyük 10 dosya:</div>
                                {storage.top10Paths.map((f, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                                        <span style={{ maxWidth: '75%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                        <span style={{ color: '#94a3b8' }}>{formatBytes(f.size)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ color: '#64748b', fontSize: 13 }}>Veri yok</div>
                )}
            </div>

            {/* Backup List */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Database size={16} color="#a78bfa" />
                    <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>Yedekler</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={loadBackups} disabled={loading}
                        style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 7, padding: '5px 10px', color: '#94a3b8', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Yenile
                    </button>
                    <button onClick={createBackup} disabled={creating}
                        style={{ background: '#7c3aed', border: 'none', borderRadius: 7, padding: '5px 12px', color: '#fff', cursor: creating ? 'wait' : 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {creating ? <Loader2 size={12} /> : <Database size={12} />} Yedek Al
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ color: '#64748b', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Yükleniyor...</div>
            ) : backups.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Yedek bulunamadi</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {backups.map((b, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '8px 12px' }}>
                            <div>
                                <div style={{ color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace' }}>{b.name.split('/').pop()}</div>
                                <div style={{ color: '#64748b', fontSize: 11 }}>
                                    {b.created ? new Date(b.created).toLocaleString('tr-TR') : '-'}
                                    {b.size ? ` · ${formatBytes(b.size)}` : ''}
                                </div>
                            </div>
                            <a href={b.signedUrl} target="_blank" rel="noreferrer"
                                style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#1e3a5f', border: '1px solid #2563eb', borderRadius: 6, padding: '4px 10px', color: '#60a5fa', fontSize: 12, textDecoration: 'none' }}>
                                <Download size={12} /> Indir
                            </a>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

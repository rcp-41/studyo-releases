import { useState, useEffect, useRef } from 'react';
import { Play, RefreshCcw, CheckCircle, XCircle, Clock, Loader2, ChevronDown } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { onSnapshot, doc, getFirestore } from 'firebase/firestore';
import toast from 'react-hot-toast';

const db = getFirestore();

const OPERATIONS = [
    { value: 'updatePlan', label: 'Plan Güncelle', params: [{ name: 'plan', label: 'Plan', type: 'select', options: ['basic', 'pro', 'enterprise'] }] },
    { value: 'updateSubscription', label: 'Abonelik Güncelle', params: [
        { name: 'status', label: 'Durum', type: 'select', options: ['active', 'trial', 'suspended', 'expired'] },
        { name: 'expiresAt', label: 'Bitiş Tarihi', type: 'date' },
    ]},
    { value: 'sendAnnouncement', label: 'Duyuru Gönder', params: [
        { name: 'title', label: 'Başlık', type: 'text' },
        { name: 'message', label: 'Mesaj', type: 'textarea' },
    ]},
    { value: 'export', label: 'Dışa Aktar', params: [] },
    { value: 'backup', label: 'Yedekle', params: [] },
];

function statusColor(status) {
    if (status === 'done') return '#22c55e';
    if (status === 'failed') return '#ef4444';
    if (status === 'running') return '#f59e0b';
    return '#6366f1';
}

function StatusBadge({ status }) {
    const colors = { queued: '#6366f1', running: '#f59e0b', done: '#22c55e', failed: '#ef4444' };
    const labels = { queued: 'Kuyrukta', running: 'Çalışıyor', done: 'Tamamlandı', failed: 'Başarısız' };
    return (
        <span style={{
            fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
            background: (colors[status] || '#6366f1') + '22', color: colors[status] || '#6366f1'
        }}>
            {labels[status] || status}
        </span>
    );
}

export default function BulkOperations() {
    const [studios, setStudios] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [operation, setOperation] = useState('');
    const [params, setParams] = useState({});
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingStudios, setLoadingStudios] = useState(true);
    const [activeJobId, setActiveJobId] = useState(null);
    const [activeJob, setActiveJob] = useState(null);
    const unsubRef = useRef(null);

    useEffect(() => {
        loadStudios();
        loadJobs();
    }, []);

    useEffect(() => {
        if (activeJobId) {
            if (unsubRef.current) unsubRef.current();
            unsubRef.current = onSnapshot(
                doc(db, 'bulkJobs', activeJobId),
                snap => {
                    if (snap.exists()) setActiveJob({ id: snap.id, ...snap.data() });
                }
            );
        }
        return () => { if (unsubRef.current) unsubRef.current(); };
    }, [activeJobId]);

    async function loadStudios() {
        try {
            const fn = httpsCallable(functions, 'setup-getStudiosWithStats');
            const res = await fn({});
            setStudios(res.data?.studios || []);
        } catch (err) {
            toast.error('Stüdyolar yüklenemedi');
        } finally {
            setLoadingStudios(false);
        }
    }

    async function loadJobs() {
        try {
            const fn = httpsCallable(functions, 'setup-listBulkJobs');
            const res = await fn({});
            setJobs(res.data?.jobs || []);
        } catch (_) { /* ignore */ }
    }

    function toggleStudio(id) {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }

    function toggleAll() {
        if (selectedIds.length === studios.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(studios.map(s => s.id));
        }
    }

    const opDef = OPERATIONS.find(o => o.value === operation);

    async function handleRun() {
        if (!operation) { toast.error('Operasyon seçin'); return; }
        if (selectedIds.length === 0) { toast.error('En az bir stüdyo seçin'); return; }

        setLoading(true);
        try {
            const fn = httpsCallable(functions, 'setup-bulkOperation');
            const res = await fn({ operation, studioIds: selectedIds, params });
            const jobId = res.data?.jobId;
            toast.success(`Job oluşturuldu: ${jobId}`);
            setActiveJobId(jobId);
            await loadJobs();
        } catch (err) {
            toast.error(err.message || 'İşlem başlatılamadı');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Toplu İşlemler</h1>
                <button className="btn btn-secondary" onClick={loadJobs}>
                    <RefreshCcw size={14} /> Yenile
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Left: Studio selection + operation form */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Stüdyo Seç</h2>
                        <button className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={toggleAll}>
                            {selectedIds.length === studios.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                        </button>
                    </div>
                    <div style={{ padding: '0 20px 8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {selectedIds.length} / {studios.length} seçili
                    </div>
                    {loadingStudios ? (
                        <div style={{ padding: '24px', textAlign: 'center' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
                    ) : (
                        <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '0 20px 16px' }}>
                            {studios.map(s => (
                                <label key={s.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0',
                                    borderBottom: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '13px'
                                }}>
                                    <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleStudio(s.id)} />
                                    <span style={{ flex: 1 }}>{s.name || s.info?.name || s.id}</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.plan || '-'}</span>
                                </label>
                            ))}
                        </div>
                    )}

                    {/* Operation selector */}
                    <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Operasyon</label>
                        <select className="input" value={operation} onChange={e => { setOperation(e.target.value); setParams({}); }}>
                            <option value="">Seçin...</option>
                            {OPERATIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    {/* Dynamic param form */}
                    {opDef && opDef.params.length > 0 && (
                        <div style={{ padding: '0 20px 16px' }}>
                            {opDef.params.map(p => (
                                <div key={p.name} style={{ marginBottom: '12px' }}>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>{p.label}</label>
                                    {p.type === 'select' ? (
                                        <select className="input" value={params[p.name] || ''} onChange={e => setParams(prev => ({ ...prev, [p.name]: e.target.value }))}>
                                            <option value="">Seçin...</option>
                                            {p.options.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    ) : p.type === 'textarea' ? (
                                        <textarea className="input" rows={3} value={params[p.name] || ''} onChange={e => setParams(prev => ({ ...prev, [p.name]: e.target.value }))} />
                                    ) : (
                                        <input className="input" type={p.type} value={params[p.name] || ''} onChange={e => setParams(prev => ({ ...prev, [p.name]: e.target.value }))} />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ padding: '0 20px 20px' }}>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleRun} disabled={loading}>
                            {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
                            Çalıştır
                        </button>
                    </div>
                </div>

                {/* Right: Active job progress + history */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Active job */}
                    {activeJob && (
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Aktif Job İlerlemesi</h2>
                                <StatusBadge status={activeJob.status} />
                            </div>
                            <div style={{ padding: '0 20px 20px' }}>
                                <div style={{ marginBottom: '8px', fontSize: '13px' }}>
                                    <b>Operasyon:</b> {activeJob.operation} &nbsp;|&nbsp;
                                    <b>Toplam:</b> {activeJob.totalCount}
                                </div>
                                {/* Progress bar */}
                                <div style={{ background: 'var(--bg-hover)', borderRadius: '4px', height: '10px', overflow: 'hidden', marginBottom: '6px' }}>
                                    <div style={{
                                        width: `${activeJob.totalCount > 0 ? Math.round(((activeJob.doneCount + activeJob.failedCount) / activeJob.totalCount) * 100) : 0}%`,
                                        height: '100%', background: statusColor(activeJob.status), transition: 'width 0.5s'
                                    }} />
                                </div>
                                <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                                    <span style={{ color: '#22c55e' }}><CheckCircle size={12} /> {activeJob.doneCount} tamamlandı</span>
                                    <span style={{ color: '#ef4444' }}><XCircle size={12} /> {activeJob.failedCount} başarısız</span>
                                </div>
                                {activeJob.errors?.length > 0 && (
                                    <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--danger)' }}>
                                        {activeJob.errors.slice(0, 5).map((e, i) => (
                                            <div key={i}>{e.studioId}: {e.error}</div>
                                        ))}
                                        {activeJob.errors.length > 5 && <div>... ve {activeJob.errors.length - 5} daha</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Job history */}
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title"><Clock size={16} /> Job Geçmişi</h2>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Operasyon</th>
                                        <th>Toplam</th>
                                        <th>Tamam</th>
                                        <th>Hata</th>
                                        <th>Durum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {jobs.length === 0 ? (
                                        <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Henüz job yok</td></tr>
                                    ) : jobs.map(j => (
                                        <tr key={j.id} style={{ cursor: 'pointer' }} onClick={() => setActiveJobId(j.id)}>
                                            <td>{j.operation}</td>
                                            <td>{j.totalCount}</td>
                                            <td style={{ color: '#22c55e' }}>{j.doneCount}</td>
                                            <td style={{ color: j.failedCount > 0 ? '#ef4444' : undefined }}>{j.failedCount}</td>
                                            <td><StatusBadge status={j.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect, useCallback } from 'react';
import { Shield, Search, RefreshCcw, ChevronDown, ChevronRight, Loader2, Filter, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { creatorApi } from '../services/creatorApi';

const ACTION_TYPES = [
    '', 'create', 'update', 'delete', 'reset', 'license',
    'hwid_reset', 'hwid_registered', 'suspend', 'activate',
    'login', 'device_approved', 'device_rejected'
];

function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('tr-TR');
}

function ActionBadge({ action }) {
    const colors = {
        create: '#22c55e',
        delete: '#ef4444',
        update: '#3b82f6',
        reset: '#f59e0b',
        license: '#8b5cf6',
        hwid_reset: '#f59e0b',
        suspend: '#ef4444',
        activate: '#22c55e',
        login: '#64748b',
    };
    const color = colors[action] || '#94a3b8';
    return (
        <span style={{
            fontSize: '11px', fontWeight: 600, padding: '2px 8px',
            borderRadius: '10px', background: color + '22', color
        }}>
            {action || '—'}
        </span>
    );
}

function JsonExpand({ data }) {
    const [open, setOpen] = useState(false);
    if (!data || Object.keys(data).length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>;
    return (
        <div>
            <button
                onClick={() => setOpen(o => !o)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
                {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Detay
            </button>
            {open && (
                <pre style={{
                    marginTop: '4px', padding: '8px', borderRadius: '6px',
                    background: 'var(--bg-secondary)', fontSize: '11px',
                    maxWidth: '320px', overflow: 'auto', maxHeight: '200px',
                    color: 'var(--text-primary)'
                }}>
                    {JSON.stringify(data, null, 2)}
                </pre>
            )}
        </div>
    );
}

export default function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    const [filterAction, setFilterAction] = useState('');
    const [filterStudio, setFilterStudio] = useState('');
    const [filterOrg, setFilterOrg] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [pageLimit, setPageLimit] = useState(50);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const result = await creatorApi.getCreatorAuditLogs({
                organizationId: filterOrg || undefined,
                studioId: filterStudio || undefined,
                action: filterAction || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                limit: pageLimit
            });
            setLogs(result?.logs || []);
        } catch (err) {
            toast.error('Loglar yüklenemedi');
        } finally {
            setLoading(false);
        }
    }, [filterAction, filterStudio, filterOrg, dateFrom, dateTo, pageLimit]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    function clearFilters() {
        setFilterAction('');
        setFilterStudio('');
        setFilterOrg('');
        setDateFrom('');
        setDateTo('');
        setPageLimit(50);
    }

    const hasFilters = filterAction || filterStudio || filterOrg || dateFrom || dateTo;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Shield size={24} /> Audit Loglar
                </h1>
                <button className="btn btn-secondary" onClick={fetchLogs} disabled={loading}>
                    <RefreshCcw size={16} /> Yenile
                </button>
            </div>

            {/* Filters */}
            <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ minWidth: '160px' }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Aksiyon</label>
                        <select className="form-input" value={filterAction} onChange={e => setFilterAction(e.target.value)} style={{ fontSize: '13px' }}>
                            {ACTION_TYPES.map(a => (
                                <option key={a} value={a}>{a || 'Tüm aksiyonlar'}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ minWidth: '160px' }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Stüdyo ID</label>
                        <input className="form-input" placeholder="studioId" value={filterStudio}
                            onChange={e => setFilterStudio(e.target.value)} style={{ fontSize: '13px' }} />
                    </div>
                    <div style={{ minWidth: '160px' }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Başlangıç</label>
                        <input type="date" className="form-input" value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)} style={{ fontSize: '13px' }} />
                    </div>
                    <div style={{ minWidth: '160px' }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Bitiş</label>
                        <input type="date" className="form-input" value={dateTo}
                            onChange={e => setDateTo(e.target.value)} style={{ fontSize: '13px' }} />
                    </div>
                    <div style={{ minWidth: '100px' }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Limit</label>
                        <select className="form-input" value={pageLimit} onChange={e => setPageLimit(Number(e.target.value))} style={{ fontSize: '13px' }}>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary btn-sm" onClick={fetchLogs} disabled={loading}>
                            <Filter size={14} /> Uygula
                        </button>
                        {hasFilters && (
                            <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
                                <X size={14} /> Temizle
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="loader"><div className="loader-spinner"></div></div>
            ) : logs.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                    Log bulunamadı.
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Zaman</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Aksiyon</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Kullanıcı</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Stüdyo / Hedef</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Detay</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {formatDate(log.createdAt || log.timestamp)}
                                        </td>
                                        <td style={{ padding: '8px 12px' }}>
                                            <ActionBadge action={log.action} />
                                        </td>
                                        <td style={{ padding: '8px 12px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {log.userName || log.userId || '—'}
                                        </td>
                                        <td style={{ padding: '8px 12px', maxWidth: '180px' }}>
                                            {log.studioId && <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--text-muted)' }}>{log.studioId}</div>}
                                            {log.targetId && <div style={{ fontSize: '11px' }}>{log.targetId}</div>}
                                        </td>
                                        <td style={{ padding: '8px 12px' }}>
                                            <JsonExpand data={log.details} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '12px' }}>
                        {logs.length} kayıt
                    </div>
                </div>
            )}
        </div>
    );
}

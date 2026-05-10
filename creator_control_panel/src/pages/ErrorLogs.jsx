import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Search, Filter } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { creatorApi } from '../services/creatorApi';
import toast from 'react-hot-toast';

const SEVERITIES = ['', 'info', 'warn', 'error', 'fatal'];
const SEV_COLORS = { info: '#38bdf8', warn: '#f59e0b', error: '#ef4444', fatal: '#7c3aed' };

export default function ErrorLogs() {
    const [logs, setLogs] = useState([]);
    const [trend, setTrend] = useState([]);
    const [loading, setLoading] = useState(false);

    const [studioFilter, setStudioFilter] = useState('');
    const [severityFilter, setSeverityFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchText, setSearchText] = useState('');
    const [expandedIds, setExpandedIds] = useState({});

    const loadLogs = async () => {
        setLoading(true);
        try {
            const result = await creatorApi.getErrorLogsAdvanced({
                studioId: studioFilter || undefined,
                severity: severityFilter || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                limit: 200,
                searchText: searchText || undefined
            });
            setLogs(result?.logs || []);
            setTrend(result?.trend || []);
        } catch (err) {
            toast.error('Loglar yuklenemedi');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadLogs(); }, []);

    const toggleExpand = (id) => setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));

    const formatDate = (ts) => {
        if (!ts) return '-';
        return new Date(ts).toLocaleString('tr-TR');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                    <h1 className="text-2xl font-bold">Hata Logları</h1>
                </div>
                <button onClick={loadLogs} disabled={loading}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white">
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Trend Chart */}
            {trend.length > 0 && (
                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '16px 20px' }}>
                    <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>Son 7 Gün Hata Trendi</div>
                    <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={trend} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                            <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                            <Area type="monotone" dataKey="error" stroke={SEV_COLORS.error} fill={SEV_COLORS.error + '30'} name="Error" />
                            <Area type="monotone" dataKey="warn" stroke={SEV_COLORS.warn} fill={SEV_COLORS.warn + '30'} name="Warn" />
                            <Area type="monotone" dataKey="fatal" stroke={SEV_COLORS.fatal} fill={SEV_COLORS.fatal + '30'} name="Fatal" />
                            <Area type="monotone" dataKey="info" stroke={SEV_COLORS.info} fill={SEV_COLORS.info + '20'} name="Info" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Filters */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                <div>
                    <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 4 }}>Studio ID</label>
                    <input value={studioFilter} onChange={e => setStudioFilter(e.target.value)}
                        placeholder="Studio ID..."
                        style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 7, padding: '6px 10px', color: '#e2e8f0', fontSize: 12, width: 160 }} />
                </div>
                <div>
                    <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 4 }}>Severity</label>
                    <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
                        style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 7, padding: '6px 10px', color: '#e2e8f0', fontSize: 12 }}>
                        <option value="">Tumu</option>
                        {SEVERITIES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 4 }}>Baslangic</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                        style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 7, padding: '6px 10px', color: '#e2e8f0', fontSize: 12 }} />
                </div>
                <div>
                    <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 4 }}>Bitis</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                        style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 7, padding: '6px 10px', color: '#e2e8f0', fontSize: 12 }} />
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                    <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 4 }}>Metin Ara</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', border: '1px solid #334155', borderRadius: 7, padding: '6px 10px' }}>
                        <Search size={12} color="#64748b" />
                        <input value={searchText} onChange={e => setSearchText(e.target.value)}
                            placeholder="mesaj, stack..."
                            style={{ background: 'none', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: 12, flex: 1 }} />
                    </div>
                </div>
                <button onClick={loadLogs} disabled={loading}
                    style={{ background: '#3b82f6', border: 'none', borderRadius: 7, padding: '7px 14px', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Filter size={12} /> Uygula
                </button>
            </div>

            {/* Table */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr style={{ background: '#1e293b', color: '#64748b' }}>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Tarih</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Studio</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Severity</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Mesaj</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Stack</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Yukleniyor...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Log bulunamadi</td></tr>
                        ) : logs.map((log) => (
                            <>
                                <tr key={log.id}
                                    onClick={() => log.stack && toggleExpand(log.id)}
                                    style={{ borderTop: '1px solid #1e293b', cursor: log.stack ? 'pointer' : 'default' }}>
                                    <td style={{ padding: '8px 14px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{formatDate(log.createdAt)}</td>
                                    <td style={{ padding: '8px 14px', color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>{log.studioId || '-'}</td>
                                    <td style={{ padding: '8px 14px' }}>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                                            background: (SEV_COLORS[log.severity] || '#64748b') + '25',
                                            color: SEV_COLORS[log.severity] || '#94a3b8',
                                            border: `1px solid ${(SEV_COLORS[log.severity] || '#64748b')}40`
                                        }}>{log.severity || 'error'}</span>
                                    </td>
                                    <td style={{ padding: '8px 14px', color: '#cbd5e1', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {log.message || '-'}
                                    </td>
                                    <td style={{ padding: '8px 14px', color: '#475569' }}>
                                        {log.stack ? (expandedIds[log.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : '-'}
                                    </td>
                                </tr>
                                {expandedIds[log.id] && log.stack && (
                                    <tr key={log.id + '_stack'} style={{ background: '#020617' }}>
                                        <td colSpan={5} style={{ padding: '10px 14px' }}>
                                            <pre style={{ color: '#94a3b8', fontSize: 11, whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'monospace', maxHeight: 200, overflowY: 'auto' }}>
                                                {log.stack}
                                            </pre>
                                        </td>
                                    </tr>
                                )}
                            </>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ color: '#475569', fontSize: 11, textAlign: 'right' }}>
                Toplam {logs.length} kayit
            </div>
        </div>
    );
}

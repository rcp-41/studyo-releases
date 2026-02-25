import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { AlertTriangle, RefreshCw, Filter } from 'lucide-react';

export default function ErrorLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [studioFilter, setStudioFilter] = useState('all');
    const [studios, setStudios] = useState([]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const func = httpsCallable(functions, 'admin-getErrorLogs');
            const result = await func({
                studioId: studioFilter === 'all' ? null : studioFilter,
                limit: 100
            });
            setLogs(result.data?.data || []);
        } catch (err) {
            console.error('Error loading logs:', err);
        }
        setLoading(false);
    };

    const loadStudios = async () => {
        try {
            const func = httpsCallable(functions, 'admin-getStudiosWithStats');
            const result = await func({});
            setStudios(result.data?.data || []);
        } catch {}
    };

    useEffect(() => { loadStudios(); }, []);
    useEffect(() => { loadLogs(); }, [studioFilter]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                    <h1 className="text-2xl font-bold">Hata Logları</h1>
                </div>
                <div className="flex items-center gap-3">
                    <select value={studioFilter} onChange={e => setStudioFilter(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-gray-600 bg-gray-800 text-white text-sm">
                        <option value="all">Tüm Stüdyolar</option>
                        {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button onClick={loadLogs} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white">
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm text-gray-300">
                    <thead className="bg-gray-800/50 text-gray-400">
                        <tr>
                            <th className="px-4 py-3 text-left">Tarih</th>
                            <th className="px-4 py-3 text-left">Kullanıcı</th>
                            <th className="px-4 py-3 text-left">Bilgisayar</th>
                            <th className="px-4 py-3 text-left">Tip</th>
                            <th className="px-4 py-3 text-left">Mesaj</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {loading ? (
                            <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">Yükleniyor...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">Hata logu bulunamadı</td></tr>
                        ) : logs.map((log, i) => (
                            <tr key={log.id || i} className="hover:bg-gray-800/50">
                                <td className="px-4 py-3 text-xs whitespace-nowrap">
                                    {log.timestamp ? new Date(log.timestamp._seconds ? log.timestamp._seconds * 1000 : log.timestamp).toLocaleString('tr-TR') : '-'}
                                </td>
                                <td className="px-4 py-3 text-xs">{log.userEmail || '-'}</td>
                                <td className="px-4 py-3 text-xs">{log.computerName || '-'}</td>
                                <td className="px-4 py-3">
                                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-medium">
                                        {log.type || 'error'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs max-w-md truncate" title={log.message}>{log.message || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

import { useState } from 'react';
import { Download, X, Loader2 } from 'lucide-react';
import { creatorApi } from '../services/creatorApi';
import toast from 'react-hot-toast';

const AVAILABLE_COLLECTIONS = [
    { key: 'archives', label: 'Arsiv' },
    { key: 'appointments', label: 'Randevular' },
    { key: 'customers', label: 'Müsteriler' },
    { key: 'shoots', label: 'Cekimler' },
    { key: 'packages', label: 'Paketler' },
    { key: 'shootTypes', label: 'Cekim Türleri' },
    { key: 'locations', label: 'Lokasyonlar' },
    { key: 'photographers', label: 'Fotografcilar' },
    { key: 'priceLists', label: 'Fiyat Listeleri' },
    { key: 'settings', label: 'Ayarlar' },
    { key: 'finance', label: 'Finans' },
];

export default function ExportModal({ studio, onClose }) {
    const [selected, setSelected] = useState(AVAILABLE_COLLECTIONS.map(c => c.key));
    const [format, setFormat] = useState('json');
    const [loading, setLoading] = useState(false);
    const [resultUrl, setResultUrl] = useState(null);

    const toggle = (key) => setSelected(prev =>
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );

    const handleExport = async () => {
        if (selected.length === 0) return toast.error('En az bir koleksiyon secin');
        setLoading(true);
        setResultUrl(null);
        try {
            const result = await creatorApi.exportStudioData(studio.organizationId, studio.id, selected, format);
            setResultUrl(result.signedUrl);
            toast.success('Export hazir! 24 saat gecerli link.');
        } catch (err) {
            // toasted
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 12, padding: 28, width: 460, maxWidth: '95vw' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Download size={18} color="#34d399" />
                        <span style={{ fontWeight: 700, fontSize: 16, color: '#e2e8f0' }}>Veri Export</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
                </div>

                <div style={{ marginBottom: 12, color: '#94a3b8', fontSize: 13 }}>
                    Stüdyo: <strong style={{ color: '#6ee7b7' }}>{studio.info?.name || studio.id}</strong>
                </div>

                <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>Koleksiyonlar</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {AVAILABLE_COLLECTIONS.map(col => (
                            <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: '#cbd5e1', fontSize: 13 }}>
                                <input type="checkbox" checked={selected.includes(col.key)} onChange={() => toggle(col.key)} />
                                {col.label}
                            </label>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Format</label>
                    <div style={{ display: 'flex', gap: 12 }}>
                        {['json', 'csv'].map(f => (
                            <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: format === f ? '#818cf8' : '#64748b', fontSize: 13 }}>
                                <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} />
                                {f.toUpperCase()}
                            </label>
                        ))}
                    </div>
                </div>

                {resultUrl && (
                    <div style={{ background: '#052e16', border: '1px solid #16a34a', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                        <div style={{ color: '#4ade80', fontSize: 12, marginBottom: 6 }}>Export hazir (24 saat gecerli):</div>
                        <a href={resultUrl} target="_blank" rel="noreferrer"
                            style={{ color: '#86efac', fontSize: 12, wordBreak: 'break-all', textDecoration: 'underline' }}>
                            Dosyayi indir
                        </a>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #334155', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
                        Kapat
                    </button>
                    <button onClick={handleExport} disabled={loading}
                        style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: loading ? 'wait' : 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {loading ? <Loader2 size={14} /> : <Download size={14} />}
                        {loading ? 'Hazirlaniyor...' : 'Export Et'}
                    </button>
                </div>
            </div>
        </div>
    );
}

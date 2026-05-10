/**
 * Broadcasts — BroadcastQueue durum listesi
 * broadcastQueue koleksiyonundaki kayıtları gerçek zamanlı gösterir.
 * Her broadcast için: status, dispatchedCount/totalStudios, errors.
 */
import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Send, Loader2, RefreshCw, ChevronDown, ChevronUp, MessageSquare, Mail } from 'lucide-react';

const STATUS_STYLES = {
    pending:      { bg: '#1e3a5f', text: '#93c5fd', label: 'Bekliyor' },
    processing:   { bg: '#312e81', text: '#c4b5fd', label: 'Isleniyor' },
    sent:         { bg: '#14532d', text: '#86efac', label: 'Gonderildi' },
    partial_sent: { bg: '#713f12', text: '#fde68a', label: 'Kismi Gonderildi' },
    failed:       { bg: '#7f1d1d', text: '#fca5a5', label: 'Basarisiz' },
};

function StatusBadge({ status }) {
    const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
    return (
        <span style={{ background: s.bg, color: s.text, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
            {s.label}
        </span>
    );
}

function ChannelIcon({ channel }) {
    if (channel === 'whatsapp') return <MessageSquare style={{ width: 14, height: 14, color: '#22c55e' }} />;
    return <Mail style={{ width: 14, height: 14, color: '#60a5fa' }} />;
}

function BroadcastRow({ item }) {
    const [expanded, setExpanded] = useState(false);
    const hasErrors = Array.isArray(item.errors) && item.errors.length > 0;
    const createdAt = item.createdAt?.toDate ? item.createdAt.toDate() : null;
    const completedAt = item.completedAt?.toDate ? item.completedAt.toDate() : null;

    return (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, marginBottom: 8 }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <ChannelIcon channel={item.channel} />
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <StatusBadge status={item.status} />
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>
                            {item.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                        </span>
                        <span style={{ color: '#64748b', fontSize: 11 }}>
                            hedef: <strong style={{ color: '#94a3b8' }}>{item.target}</strong>
                            {item.targetIds?.length > 0 && ` (${item.targetIds.length} ID)`}
                        </span>
                    </div>
                    <div style={{ color: '#f1f5f9', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 400 }}>
                        {item.subject ? <><strong>{item.subject}</strong> — </> : null}
                        {item.body}
                    </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
                        {item.dispatchedCount ?? 0}
                        {item.totalStudios != null ? ` / ${item.totalStudios}` : ''}
                    </div>
                    <div style={{ color: '#64748b', fontSize: 11 }}>gonderilen</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 90 }}>
                    {createdAt && <div style={{ color: '#64748b', fontSize: 11 }}>{createdAt.toLocaleDateString('tr-TR')} {createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>}
                    {completedAt && <div style={{ color: '#64748b', fontSize: 11 }}>bitti: {completedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>}
                </div>
                {hasErrors && (
                    <button onClick={() => setExpanded(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                        {expanded ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
                    </button>
                )}
            </div>
            {expanded && hasErrors && (
                <div style={{ borderTop: '1px solid #334155', padding: '10px 16px' }}>
                    <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 6 }}>Hatalar ({item.errors.length})</div>
                    {item.errors.map((e, i) => (
                        <div key={i} style={{ color: '#fca5a5', fontSize: 11, fontFamily: 'monospace', marginBottom: 2 }}>{e}</div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function Broadcasts() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(
            collection(db, 'broadcastQueue'),
            orderBy('createdAt', 'desc'),
            limit(100)
        );

        const unsub = onSnapshot(q, (snap) => {
            setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error('[Broadcasts] Snapshot error:', err);
            setLoading(false);
        });

        return () => unsub();
    }, []);

    return (
        <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h1 style={{ color: '#f1f5f9', fontSize: 22, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Send style={{ width: 20, height: 20, color: '#3b82f6' }} />
                    Broadcast Kuyrugu
                </h1>
                <span style={{ color: '#64748b', fontSize: 13 }}>Gercek zamanli — son 100 kayit</span>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                    <Loader2 style={{ width: 28, height: 28, color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
                    <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
                </div>
            ) : items.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: 48 }}>
                    <Send style={{ width: 36, height: 36, margin: '0 auto 12px', opacity: 0.3 }} />
                    <div>Broadcast kaydı bulunamadı.</div>
                </div>
            ) : (
                <div>
                    {items.map(item => <BroadcastRow key={item.id} item={item} />)}
                    <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
                </div>
            )}
        </div>
    );
}

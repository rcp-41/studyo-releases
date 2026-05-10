import { useState, useEffect } from 'react';
import { Plus, RefreshCcw, MessageSquare, Clock, CheckCircle, Loader2, Send } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import toast from 'react-hot-toast';

const STATUS_LABELS = { open: 'Açık', in_progress: 'İşlemde', closed: 'Kapalı' };
const STATUS_COLORS = { open: '#6366f1', in_progress: '#f59e0b', closed: '#94a3b8' };
const PRIORITY_LABELS = { low: 'Düşük', normal: 'Normal', high: 'Yüksek', urgent: 'Acil' };
const PRIORITY_COLORS = { low: '#94a3b8', normal: '#6366f1', high: '#f59e0b', urgent: '#ef4444' };

function Badge({ label, color }) {
    return (
        <span style={{
            fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
            background: color + '22', color
        }}>{label}</span>
    );
}

export default function SupportTickets() {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [filterStatus, setFilterStatus] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ studioId: '', subject: '', body: '', priority: 'normal' });

    useEffect(() => { loadTickets(); }, [filterStatus]);

    async function loadTickets() {
        setLoading(true);
        try {
            const fn = httpsCallable(functions, 'setup-listTickets');
            const res = await fn({ status: filterStatus || undefined });
            setTickets(res.data?.tickets || []);
        } catch (err) {
            toast.error('Ticketlar yüklenemedi');
        } finally {
            setLoading(false);
        }
    }

    async function handleReply() {
        if (!replyText.trim()) return;
        setSubmitting(true);
        try {
            const fn = httpsCallable(functions, 'setup-replyTicket');
            await fn({ ticketId: selected.id, message: replyText.trim() });
            setReplyText('');
            toast.success('Yanıt gönderildi');
            await loadTickets();
            // Refresh selected
            const updated = tickets.find(t => t.id === selected.id);
            if (updated) setSelected(updated);
        } catch (err) {
            toast.error(err.message || 'Yanıt gönderilemedi');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleStatusChange(ticketId, status) {
        try {
            const fn = httpsCallable(functions, 'setup-updateTicketStatus');
            await fn({ ticketId, status });
            toast.success('Durum güncellendi');
            await loadTickets();
        } catch (err) {
            toast.error(err.message || 'Durum güncellenemedi');
        }
    }

    async function handleCreate() {
        if (!createForm.studioId || !createForm.subject || !createForm.body) {
            toast.error('Tüm alanları doldurun');
            return;
        }
        setSubmitting(true);
        try {
            const fn = httpsCallable(functions, 'setup-createTicket');
            await fn(createForm);
            toast.success('Ticket oluşturuldu');
            setShowCreate(false);
            setCreateForm({ studioId: '', subject: '', body: '', priority: 'normal' });
            await loadTickets();
        } catch (err) {
            toast.error(err.message || 'Ticket oluşturulamadı');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Destek Ticketları</h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <select className="input" style={{ width: '140px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="">Tüm Durumlar</option>
                        {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <button className="btn btn-secondary" onClick={loadTickets}><RefreshCcw size={14} /></button>
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} /> Yeni Ticket</button>
                </div>
            </div>

            {/* Create modal */}
            {showCreate && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card" style={{ width: '480px', maxWidth: '95vw' }}>
                        <div className="card-header">
                            <h2 className="card-title">Yeni Ticket</h2>
                            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Kapat</button>
                        </div>
                        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <input className="input" placeholder="Studio ID" value={createForm.studioId} onChange={e => setCreateForm(p => ({ ...p, studioId: e.target.value }))} />
                            <input className="input" placeholder="Konu" value={createForm.subject} onChange={e => setCreateForm(p => ({ ...p, subject: e.target.value }))} />
                            <textarea className="input" rows={4} placeholder="Açıklama" value={createForm.body} onChange={e => setCreateForm(p => ({ ...p, body: e.target.value }))} />
                            <select className="input" value={createForm.priority} onChange={e => setCreateForm(p => ({ ...p, priority: e.target.value }))}>
                                {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
                                {submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                                Oluştur
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
                {/* Ticket list */}
                <div className="card">
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-muted)' }}>
                        {tickets.length} ticket
                    </div>
                    {loading ? (
                        <div style={{ padding: '32px', textAlign: 'center' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
                    ) : (
                        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                            {tickets.length === 0 ? (
                                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Ticket bulunamadı</div>
                            ) : tickets.map(t => (
                                <div key={t.id}
                                    onClick={() => setSelected(t)}
                                    style={{
                                        padding: '14px 20px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)',
                                        background: selected?.id === t.id ? 'var(--bg-hover)' : undefined
                                    }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{t.subject}</span>
                                        <Badge label={STATUS_LABELS[t.status] || t.status} color={STATUS_COLORS[t.status] || '#6366f1'} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                        <span>{t.studioId}</span>
                                        <Badge label={PRIORITY_LABELS[t.priority] || t.priority} color={PRIORITY_COLORS[t.priority] || '#6366f1'} />
                                        <span style={{ marginLeft: 'auto' }}>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('tr-TR') : ''}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Ticket detail */}
                <div className="card">
                    {!selected ? (
                        <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <MessageSquare size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
                            <p>Bir ticket seçin</p>
                        </div>
                    ) : (
                        <>
                            <div className="card-header">
                                <div>
                                    <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{selected.subject}</h2>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <Badge label={STATUS_LABELS[selected.status] || selected.status} color={STATUS_COLORS[selected.status] || '#6366f1'} />
                                        <Badge label={PRIORITY_LABELS[selected.priority] || selected.priority} color={PRIORITY_COLORS[selected.priority] || '#6366f1'} />
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selected.studioId}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {selected.status !== 'closed' && (
                                        <button className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={() => handleStatusChange(selected.id, 'closed')}>
                                            <CheckCircle size={12} /> Kapat
                                        </button>
                                    )}
                                    {selected.status === 'closed' && (
                                        <button className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={() => handleStatusChange(selected.id, 'open')}>
                                            Yeniden Aç
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                {selected.body}
                            </div>
                            {/* Messages */}
                            <div style={{ maxHeight: '280px', overflowY: 'auto', padding: '12px 20px' }}>
                                {(selected.messages || []).length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>Henüz mesaj yok</p>
                                ) : (selected.messages || []).map((m, i) => (
                                    <div key={i} style={{ marginBottom: '10px', background: 'var(--bg-hover)', borderRadius: '6px', padding: '8px 12px' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                            {m.uid} · {m.sentAt ? new Date(m.sentAt).toLocaleString('tr-TR') : ''}
                                        </div>
                                        <div style={{ fontSize: '13px' }}>{m.message}</div>
                                    </div>
                                ))}
                            </div>
                            {/* Reply */}
                            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input className="input" style={{ flex: 1 }} placeholder="Yanıt yaz..." value={replyText} onChange={e => setReplyText(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }} />
                                    <button className="btn btn-primary" onClick={handleReply} disabled={submitting || !replyText.trim()}>
                                        <Send size={14} />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

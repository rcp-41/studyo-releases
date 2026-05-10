import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { Bell, Plus, Trash2, RefreshCw, Loader2, Megaphone, Send } from 'lucide-react';
import toast from 'react-hot-toast';

const LEVEL_STYLES = {
    info:     { bg: '#1d4ed8', text: '#bfdbfe', label: 'Bilgi' },
    warning:  { bg: '#b45309', text: '#fef3c7', label: 'Uyari' },
    critical: { bg: '#991b1b', text: '#fee2e2', label: 'Kritik' }
};

export default function Announcements() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ title: '', body: '', level: 'info', target: 'all', targetIds: '', dismissible: true, endsAt: '', sendBroadcast: false, broadcastChannel: 'email', broadcastSubject: '' });
    const [submitting, setSubmitting] = useState(false);

    async function fetchAnnouncements() {
        setLoading(true);
        try {
            const fn = httpsCallable(functions, 'setup-listAnnouncements');
            const res = await fn({});
            setAnnouncements(res.data.announcements || []);
        } catch (e) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchAnnouncements(); }, []);

    async function handleDelete(id) {
        if (!window.confirm('Duyuruyu silmek istiyor musunuz?')) return;
        try {
            const fn = httpsCallable(functions, 'setup-deleteAnnouncement');
            await fn({ id });
            toast.success('Duyuru silindi');
            setAnnouncements(a => a.filter(x => x.id !== id));
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function handleSubmit() {
        if (!form.title || !form.body) { toast.error('Baslik ve icerik zorunlu'); return; }
        setSubmitting(true);
        try {
            const targetIds = form.targetIds ? form.targetIds.split(',').map(s => s.trim()).filter(Boolean) : [];
            const endsAt = form.endsAt ? new Date(form.endsAt).getTime() : null;

            const fn = httpsCallable(functions, 'setup-createAnnouncement');
            await fn({ title: form.title, body: form.body, level: form.level, target: form.target, targetIds, dismissible: form.dismissible, endsAt });

            if (form.sendBroadcast) {
                const bfn = httpsCallable(functions, 'setup-broadcastMessage');
                await bfn({ channel: form.broadcastChannel, target: form.target, targetIds, subject: form.broadcastSubject || form.title, body: form.body });
            }

            toast.success('Duyuru olusturuldu');
            setShowForm(false);
            setForm({ title: '', body: '', level: 'info', target: 'all', targetIds: '', dismissible: true, endsAt: '', sendBroadcast: false, broadcastChannel: 'email', broadcastSubject: '' });
            fetchAnnouncements();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setSubmitting(false);
        }
    }

    const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#f1f5f9', fontSize: 14 };
    const labelStyle = { color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 6 };

    return (
        <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h1 style={{ color: '#f1f5f9', fontSize: 24, margin: 0 }}>Duyurular</h1>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={fetchAnnouncements} style={{ padding: '8px 14px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <RefreshCw style={{ width: 15, height: 15 }} /> Yenile
                    </button>
                    <button onClick={() => setShowForm(v => !v)} style={{ padding: '8px 14px', borderRadius: 8, background: '#3b82f6', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Plus style={{ width: 15, height: 15 }} /> Yeni Duyuru
                    </button>
                </div>
            </div>

            {showForm && (
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                    <h3 style={{ color: '#f1f5f9', margin: '0 0 20px', fontSize: 16 }}>Yeni Duyuru Olustur</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelStyle}>Baslik</label>
                            <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Duyuru basligi..." />
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelStyle}>Icerik</label>
                            <textarea rows={4} style={{ ...inputStyle, resize: 'vertical' }} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Duyuru icerigi..." />
                        </div>
                        <div>
                            <label style={labelStyle}>Seviye</label>
                            <select style={inputStyle} value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}>
                                <option value="info">Bilgi</option>
                                <option value="warning">Uyari</option>
                                <option value="critical">Kritik</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Hedef</label>
                            <select style={inputStyle} value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))}>
                                <option value="all">Tumu</option>
                                <option value="orgIds">Organizasyonlar</option>
                                <option value="studioIds">Studyolar</option>
                            </select>
                        </div>
                        {(form.target === 'orgIds' || form.target === 'studioIds') && (
                            <div style={{ gridColumn: '1/-1' }}>
                                <label style={labelStyle}>Hedef ID'leri (virgille ayir)</label>
                                <input style={inputStyle} value={form.targetIds} onChange={e => setForm(f => ({ ...f, targetIds: e.target.value }))} placeholder="id1, id2, id3..." />
                            </div>
                        )}
                        <div>
                            <label style={labelStyle}>Bitis Tarihi (opsiyonel)</label>
                            <input type="datetime-local" style={inputStyle} value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 22 }}>
                            <input type="checkbox" id="dismissible" checked={form.dismissible} onChange={e => setForm(f => ({ ...f, dismissible: e.target.checked }))} />
                            <label htmlFor="dismissible" style={{ color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}>Kapatilabilir</label>
                        </div>
                        <div style={{ gridColumn: '1/-1', borderTop: '1px solid #334155', paddingTop: 14, marginTop: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <input type="checkbox" id="sendBroadcast" checked={form.sendBroadcast} onChange={e => setForm(f => ({ ...f, sendBroadcast: e.target.checked }))} />
                                <label htmlFor="sendBroadcast" style={{ color: '#94a3b8', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Send style={{ width: 14, height: 14 }} /> Mesaj olarak da gonder
                                </label>
                            </div>
                            {form.sendBroadcast && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingLeft: 24 }}>
                                    <div>
                                        <label style={labelStyle}>Kanal</label>
                                        <select style={inputStyle} value={form.broadcastChannel} onChange={e => setForm(f => ({ ...f, broadcastChannel: e.target.value }))}>
                                            <option value="email">Email</option>
                                            <option value="whatsapp">WhatsApp</option>
                                        </select>
                                    </div>
                                    {form.broadcastChannel === 'email' && (
                                        <div>
                                            <label style={labelStyle}>Email Konusu</label>
                                            <input style={inputStyle} value={form.broadcastSubject} onChange={e => setForm(f => ({ ...f, broadcastSubject: e.target.value }))} placeholder="Konu satiri..." />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 6, background: '#334155', color: '#94a3b8', border: 'none', cursor: 'pointer' }}>Iptal</button>
                        <button onClick={handleSubmit} disabled={submitting} style={{ padding: '8px 16px', borderRadius: 6, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {submitting ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Bell style={{ width: 14, height: 14 }} />}
                            Olustur
                        </button>
                    </div>
                    <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
                </div>
            )}

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                    <Loader2 style={{ width: 28, height: 28, color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
                </div>
            ) : announcements.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>
                    <Megaphone style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.4 }} />
                    <div>Duyuru bulunamadi.</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {announcements.map(a => {
                        const lvl = LEVEL_STYLES[a.level] || LEVEL_STYLES.info;
                        return (
                            <div key={a.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ background: lvl.bg, color: lvl.text, borderRadius: 4, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>{lvl.label}</span>
                                        <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{a.title}</span>
                                        {!a.active && <span style={{ background: '#374151', color: '#9ca3af', borderRadius: 4, padding: '1px 8px', fontSize: 11 }}>Silindi</span>}
                                    </div>
                                    <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>{a.body}</div>
                                    <div style={{ color: '#64748b', fontSize: 11, display: 'flex', gap: 12 }}>
                                        <span>Hedef: <strong>{a.target}</strong>{a.targetIds?.length > 0 ? ` (${a.targetIds.length} ID)` : ''}</span>
                                        {a.createdAt && <span>Olusturuldu: {new Date(a.createdAt).toLocaleDateString('tr-TR')}</span>}
                                        {a.endsAt && <span>Bitis: {new Date(a.endsAt).toLocaleDateString('tr-TR')}</span>}
                                    </div>
                                </div>
                                {a.active && (
                                    <button onClick={() => handleDelete(a.id)}
                                        style={{ padding: '6px 10px', borderRadius: 6, background: '#0f172a', border: '1px solid #334155', color: '#ef4444', cursor: 'pointer' }}>
                                        <Trash2 style={{ width: 14, height: 14 }} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

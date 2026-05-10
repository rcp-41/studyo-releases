import { useState, useEffect } from 'react';
import { Plus, RefreshCcw, Loader2, X, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { creatorApi } from '../services/creatorApi';

function StatusBadge({ coupon }) {
    const now = new Date();
    const expired = coupon.expiresAt && new Date(coupon.expiresAt) < now;
    const exhausted = coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit;

    if (expired) return <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 600 }}>Süresi Doldu</span>;
    if (exhausted) return <span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 600 }}>Limit Doldu</span>;
    return <span style={{ color: '#22c55e', fontSize: '11px', fontWeight: 600 }}>Aktif</span>;
}

const DEFAULT_FORM = { code: '', type: 'extension', value: '', expiresAt: '', usageLimit: '' };

export default function Coupons() {
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(DEFAULT_FORM);
    const [saving, setSaving] = useState(false);

    useEffect(() => { loadCoupons(); }, []);

    async function loadCoupons() {
        setLoading(true);
        try {
            const res = await creatorApi.listCoupons();
            setCoupons(res?.coupons || []);
        } catch (err) {
            toast.error('Kuponlar yüklenemedi');
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate(e) {
        e.preventDefault();
        const val = parseFloat(form.value);
        if (isNaN(val) || val <= 0) {
            toast.error('Geçerli bir değer girin');
            return;
        }
        setSaving(true);
        try {
            await creatorApi.createCoupon({
                code: form.code.trim().toUpperCase(),
                type: form.type,
                value: val,
                expiresAt: form.expiresAt || undefined,
                usageLimit: form.usageLimit ? parseInt(form.usageLimit) : undefined
            });
            toast.success('Kupon oluşturuldu!');
            setShowModal(false);
            setForm(DEFAULT_FORM);
            loadCoupons();
        } catch (err) {
            toast.error('Kupon oluşturulamadı: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Kupon Kodları</h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary" onClick={loadCoupons}>
                        <RefreshCcw size={16} /> Yenile
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={16} /> Yeni Kupon
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loader"><div className="loader-spinner"></div></div>
            ) : coupons.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                    <Tag size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <p style={{ color: 'var(--text-muted)' }}>Henüz kupon oluşturulmamış.</p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600 }}>Kod</th>
                                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600 }}>Tür</th>
                                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600 }}>Değer</th>
                                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600 }}>Kullanım</th>
                                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600 }}>Bitiş</th>
                                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600 }}>Durum</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coupons.map(coupon => (
                                <tr key={coupon.id} style={{ borderBottom: '1px solid var(--border-color)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, rgba(0,0,0,0.02))'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600, letterSpacing: '1px' }}>
                                        {coupon.code}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        {coupon.type === 'extension' ? (
                                            <span style={{ color: '#6366f1', fontSize: '12px', fontWeight: 600 }}>Uzatma</span>
                                        ) : (
                                            <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 600 }}>İndirim</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        {coupon.type === 'extension' ? `${coupon.value} gün` : `%${coupon.value}`}
                                    </td>
                                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                                        {coupon.usedCount}
                                        {coupon.usageLimit !== null ? ` / ${coupon.usageLimit}` : ' / Sınırsız'}
                                    </td>
                                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                        {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString('tr-TR') : 'Yok'}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <StatusBadge coupon={coupon} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
                        <div className="modal-header">
                            <h2>Yeni Kupon Oluştur</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Kupon Kodu *</label>
                                    <input type="text" className="form-input" required
                                        value={form.code}
                                        onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                                        placeholder="YILLIK2026"
                                        style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tür *</label>
                                    <select className="form-input" value={form.type}
                                        onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                                        <option value="extension">Uzatma (gün olarak)</option>
                                        <option value="discount">İndirim (% olarak)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        Değer * {form.type === 'extension' ? '(gün)' : '(%)'}
                                    </label>
                                    <input type="number" className="form-input" required
                                        min="1" max={form.type === 'discount' ? '100' : '3650'}
                                        value={form.value}
                                        onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                                        placeholder={form.type === 'extension' ? '30' : '20'}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Kullanım Limiti (Boş = sınırsız)</label>
                                    <input type="number" className="form-input" min="1"
                                        value={form.usageLimit}
                                        onChange={e => setForm(p => ({ ...p, usageLimit: e.target.value }))}
                                        placeholder="10"
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Son Kullanım Tarihi (Boş = süresiz)</label>
                                    <input type="date" className="form-input"
                                        min={new Date().toISOString().slice(0, 10)}
                                        value={form.expiresAt}
                                        onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Vazgeç</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Oluşturuluyor...</> : 'Oluştur'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

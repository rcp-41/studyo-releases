import { useState, useCallback, useRef } from 'react';
import { Search, User, Building2, Key, LogOut, HeadphonesIcon, RefreshCw, Loader2 } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import toast from 'react-hot-toast';

function useDebounce(fn, delay) {
    const timer = useRef(null);
    return useCallback((...args) => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => fn(...args), delay);
    }, [fn, delay]);
}

function ConfirmModal({ open, title, message, fields = [], onConfirm, onClose }) {
    const [values, setValues] = useState({});
    if (!open) return null;
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, width: 400, maxWidth: '90vw' }}>
                <h3 style={{ color: '#f1f5f9', margin: '0 0 8px' }}>{title}</h3>
                <p style={{ color: '#94a3b8', margin: '0 0 16px', fontSize: 14 }}>{message}</p>
                {fields.map(f => (
                    <div key={f.name} style={{ marginBottom: 12 }}>
                        <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 4 }}>{f.label}</label>
                        {f.type === 'textarea'
                            ? <textarea rows={3} placeholder={f.placeholder} value={values[f.name] || ''}
                                onChange={e => setValues(v => ({ ...v, [f.name]: e.target.value }))}
                                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: 8, color: '#f1f5f9', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
                            : <input type={f.type || 'text'} placeholder={f.placeholder} value={values[f.name] || ''}
                                onChange={e => setValues(v => ({ ...v, [f.name]: e.target.value }))}
                                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: 8, color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' }} />
                        }
                    </div>
                ))}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                    <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, background: '#334155', color: '#94a3b8', border: 'none', cursor: 'pointer' }}>Vazgec</button>
                    <button onClick={() => onConfirm(values)} style={{ padding: '8px 16px', borderRadius: 6, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer' }}>Onayla</button>
                </div>
            </div>
        </div>
    );
}

export default function UserSearch() {
    const [query, setQuery] = useState('');
    const [type, setType] = useState('email');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState(null); // { action, user }

    const doSearch = useCallback(async (q, t) => {
        if (!q || q.length < 2) { setResults([]); return; }
        setLoading(true);
        try {
            const fn = httpsCallable(functions, 'setup-searchUsers');
            const res = await fn({ query: q, type: t, limit: 20 });
            setResults(res.data.users || []);
        } catch (e) {
            toast.error(e.message || 'Arama basarisiz');
        } finally {
            setLoading(false);
        }
    }, []);

    const debouncedSearch = useDebounce(doSearch, 300);

    function handleQueryChange(e) {
        const v = e.target.value;
        setQuery(v);
        debouncedSearch(v, type);
    }

    function handleTypeChange(e) {
        setType(e.target.value);
        if (query.length >= 2) doSearch(query, e.target.value);
    }

    async function handlePasswordReset(user) {
        try {
            const fn = httpsCallable(functions, 'setup-sendPasswordReset');
            await fn({ uid: user.uid });
            toast.success(`${user.email} adresine sifre sifirlama linki gonderildi`);
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function handleRevokeSessions(user) {
        try {
            const fn = httpsCallable(functions, 'setup-revokeUserSessions');
            await fn({ uid: user.uid });
            toast.success('Tum oturumlar sonlandirildi');
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function handleStartImpersonation(user, values) {
        try {
            const fn = httpsCallable(functions, 'setup-startImpersonation');
            const res = await fn({ targetUid: user.uid, reason: values.reason });
            setModal(null);
            toast.success('Destek modu baslatildi. Token kopyalandi.');
            // TODO: open Studyo client in new tab with custom token
            navigator.clipboard?.writeText(res.data.customToken).catch(() => {});
        } catch (e) {
            toast.error(e.message);
        }
    }

    const cardStyle = {
        background: '#1e293b',
        borderRadius: 10,
        padding: '16px 20px',
        marginBottom: 12,
        border: '1px solid #334155',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16
    };

    return (
        <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
            <h1 style={{ color: '#f1f5f9', marginBottom: 24, fontSize: 24 }}>Kullanici Arama</h1>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', width: 18, height: 18 }} />
                    <input
                        value={query}
                        onChange={handleQueryChange}
                        placeholder="Email, telefon veya isim ara..."
                        style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 40, padding: '10px 12px 10px 40px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 14 }}
                    />
                </div>
                <select value={type} onChange={handleTypeChange}
                    style={{ padding: '10px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 14 }}>
                    <option value="email">Email</option>
                    <option value="phone">Telefon</option>
                    <option value="name">Isim</option>
                </select>
            </div>

            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                    <Loader2 style={{ width: 28, height: 28, color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
                    <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
                </div>
            )}

            {!loading && results.length === 0 && query.length >= 2 && (
                <div style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>Sonuc bulunamadi.</div>
            )}

            {results.map(user => (
                <div key={user.uid} style={cardStyle}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <User style={{ width: 20, height: 20, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ color: '#f1f5f9', fontWeight: 600 }}>{user.displayName || user.email || user.uid}</div>
                        <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>
                            {user.email && <span style={{ marginRight: 12 }}>{user.email}</span>}
                            {user.phone && <span style={{ marginRight: 12 }}>{user.phone}</span>}
                            {user.role && <span style={{ background: '#1d4ed8', color: '#bfdbfe', borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>{user.role}</span>}
                        </div>
                        {(user.studioName || user.orgName) && (
                            <div style={{ color: '#64748b', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Building2 style={{ width: 12, height: 12 }} />
                                {user.studioName} {user.orgName && `(${user.orgName})`}
                            </div>
                        )}
                        {user.lastLogin && (
                            <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                                Son giris: {new Date(user.lastLogin).toLocaleString('tr-TR')}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                        {user.studioId && (
                            <button onClick={() => window.location.href = `/studios?studioId=${user.studioId}`}
                                style={{ padding: '5px 10px', borderRadius: 6, background: '#0f172a', border: '1px solid #334155', color: '#94a3b8', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Building2 style={{ width: 12, height: 12 }} /> Studyoya git
                            </button>
                        )}
                        {user.email && (
                            <button onClick={() => handlePasswordReset(user)}
                                style={{ padding: '5px 10px', borderRadius: 6, background: '#0f172a', border: '1px solid #334155', color: '#94a3b8', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Key style={{ width: 12, height: 12 }} /> Sifre sifirla
                            </button>
                        )}
                        <button onClick={() => handleRevokeSessions(user)}
                            style={{ padding: '5px 10px', borderRadius: 6, background: '#0f172a', border: '1px solid #334155', color: '#ef4444', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <LogOut style={{ width: 12, height: 12 }} /> Oturumlari sonlandir
                        </button>
                        <button onClick={() => setModal({ action: 'impersonate', user })}
                            style={{ padding: '5px 10px', borderRadius: 6, background: '#7c3aed', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <HeadphonesIcon style={{ width: 12, height: 12 }} /> Destek modu
                        </button>
                    </div>
                </div>
            ))}

            <ConfirmModal
                open={modal?.action === 'impersonate'}
                title="Destek Modu Baslatma"
                message={`${modal?.user?.email || modal?.user?.uid} icin destek modu baslatilacak. Neden?`}
                fields={[{ name: 'reason', label: 'Neden (zorunlu)', type: 'textarea', placeholder: 'Destek sebebini aciklayin...' }]}
                onConfirm={(values) => {
                    if (!values.reason || values.reason.trim().length < 5) {
                        toast.error('Neden en az 5 karakter olmali');
                        return;
                    }
                    handleStartImpersonation(modal.user, values);
                }}
                onClose={() => setModal(null)}
            />
        </div>
    );
}

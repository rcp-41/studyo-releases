import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { Users, Plus, RefreshCw, Shield, Loader2, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

const ROLES = ['super', 'support', 'finance', 'readonly'];

const ROLE_COLORS = {
    super: { bg: '#7c3aed', text: '#ede9fe' },
    support: { bg: '#0284c7', text: '#e0f2fe' },
    finance: { bg: '#059669', text: '#d1fae5' },
    readonly: { bg: '#475569', text: '#e2e8f0' }
};

const ROLE_DESC = {
    super: 'Her seyi yapabilir',
    support: 'Studyo goruntulemek, audit log, sifre sifirlama, impersonation, AppCheck override',
    finance: 'Abonelik, kupon, plan degisikligi',
    readonly: 'Sadece goruntuleme'
};

export default function CreatorTeam() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inviteModal, setInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('support');
    const [inviting, setInviting] = useState(false);

    async function fetchUsers() {
        setLoading(true);
        try {
            const fn = httpsCallable(functions, 'setup-listCreatorUsers');
            const res = await fn({});
            setUsers(res.data.users || []);
        } catch (e) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchUsers(); }, []);

    async function handleRoleChange(uid, newRole) {
        try {
            const fn = httpsCallable(functions, 'setup-setCreatorRole');
            await fn({ targetUid: uid, newRole });
            toast.success('Rol guncellendi');
            setUsers(u => u.map(x => x.uid === uid ? { ...x, creator_role: newRole } : x));
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function handleInvite() {
        if (!inviteEmail || !inviteEmail.includes('@')) { toast.error('Gecerli bir email girin'); return; }
        setInviting(true);
        try {
            const fn = httpsCallable(functions, 'setup-inviteCreator');
            const res = await fn({ email: inviteEmail, role: inviteRole });
            toast.success(`Davet gonderildi: ${inviteEmail}`);
            setInviteModal(false);
            setInviteEmail('');
            fetchUsers();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setInviting(false);
        }
    }

    return (
        <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h1 style={{ color: '#f1f5f9', fontSize: 24, margin: 0 }}>Creator Takim</h1>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={fetchUsers} style={{ padding: '8px 14px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <RefreshCw style={{ width: 15, height: 15 }} /> Yenile
                    </button>
                    <button onClick={() => setInviteModal(true)} style={{ padding: '8px 14px', borderRadius: 8, background: '#3b82f6', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Plus style={{ width: 15, height: 15 }} /> Creator Davet Et
                    </button>
                </div>
            </div>

            {/* Role permissions matrix */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 20, marginBottom: 24 }}>
                <h3 style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rol Izinleri</h3>
                {ROLES.map(r => (
                    <div key={r} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                        <span style={{ background: ROLE_COLORS[r].bg, color: ROLE_COLORS[r].text, borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600, minWidth: 70, textAlign: 'center' }}>{r}</span>
                        <span style={{ color: '#64748b', fontSize: 13 }}>{ROLE_DESC[r]}</span>
                    </div>
                ))}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                    <Loader2 style={{ width: 28, height: 28, color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
                    <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {users.map(u => (
                        <div key={u.uid} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: ROLE_COLORS[u.creator_role || 'readonly']?.bg || '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Shield style={{ width: 18, height: 18, color: '#fff' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ color: '#f1f5f9', fontWeight: 600 }}>{u.displayName || u.email}</div>
                                <div style={{ color: '#64748b', fontSize: 13 }}>{u.email}</div>
                                {u.lastLogin && <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>Son giris: {new Date(u.lastLogin).toLocaleString('tr-TR')}</div>}
                            </div>
                            <div>
                                <select value={u.creator_role || 'readonly'} onChange={e => handleRoleChange(u.uid, e.target.value)}
                                    style={{ padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#f1f5f9', fontSize: 13 }}>
                                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                        </div>
                    ))}
                    {users.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>
                            <Users style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.4 }} />
                            <div>Hic creator bulunamadi.</div>
                        </div>
                    )}
                </div>
            )}

            {/* Invite modal */}
            {inviteModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#1e293b', borderRadius: 12, padding: 28, width: 400, maxWidth: '90vw' }}>
                        <h3 style={{ color: '#f1f5f9', margin: '0 0 20px' }}>Creator Davet Et</h3>
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 6 }}>Email</label>
                            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                                placeholder="ornek@email.com"
                                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#f1f5f9', fontSize: 14 }} />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 6 }}>Rol</label>
                            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                                style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#f1f5f9', fontSize: 14 }}>
                                {ROLES.map(r => <option key={r} value={r}>{r} — {ROLE_DESC[r]}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setInviteModal(false)} style={{ padding: '8px 16px', borderRadius: 6, background: '#334155', color: '#94a3b8', border: 'none', cursor: 'pointer' }}>Iptal</button>
                            <button onClick={handleInvite} disabled={inviting}
                                style={{ padding: '8px 16px', borderRadius: 6, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {inviting ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Mail style={{ width: 14, height: 14 }} />}
                                Davet Gonder
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

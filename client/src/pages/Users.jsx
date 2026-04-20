import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../services/api';
import { formatDate, getRoleLabel, getInitials, cn } from '../lib/utils';
import { Plus, Search, Edit, Trash2, Loader2, X, User, Shield, Check, Key, Calendar, CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '../components/ConfirmDialog';
import PasswordInput from '../components/PasswordInput';
import { SkeletonTable } from '../components/Skeleton';

const leaveTypes = [
    { value: 'annual', label: 'Yıllık İzin', color: 'bg-blue-500/20 text-blue-400' },
    { value: 'sick', label: 'Hastalık', color: 'bg-red-500/20 text-red-400' },
    { value: 'excuse', label: 'Mazeret', color: 'bg-yellow-500/20 text-yellow-400' }
];

function AddUserModal({ isOpen, onClose }) {
    const [formData, setFormData] = useState({
        username: '', fullName: '', email: '', phone: '', password: '', role: 'user'
    });
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: (data) => usersApi.create(data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('Kullanıcı oluşturuldu'); onClose(); },
        onError: (e) => toast.error(e.response?.data?.error || 'Hata oluştu')
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.username || !formData.fullName || !formData.password) {
            toast.error('Kullanıcı adı, ad soyad ve şifre zorunludur');
            return;
        }
        createMutation.mutate(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Yeni Kullanıcı</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Kullanıcı Adı *</label>
                        <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Ad Soyad *</label>
                        <input type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">E-posta</label>
                        <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Şifre *</label>
                        <PasswordInput value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Rol</label>
                        <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none">
                            <option value="user">Personel</option>
                            <option value="admin">Yönetici</option>
                        </select>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">İptal</button>
                        <button type="submit" disabled={createMutation.isPending}
                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Kaydet
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ===== PASSWORD RESET MODAL =====
function ResetPasswordModal({ isOpen, onClose, user }) {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const queryClient = useQueryClient();

    const resetMutation = useMutation({
        mutationFn: (data) => usersApi.resetPassword(data),
        onSuccess: () => { toast.success('Şifre başarıyla sıfırlandı'); onClose(); },
        onError: () => toast.error('Şifre sıfırlanamadı')
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (password.length < 6) return toast.error('Şifre en az 6 karakter olmalı');
        if (password !== confirm) return toast.error('Şifreler eşleşmiyor');
        resetMutation.mutate({ uid: user.uid || user.id, password });
    };

    if (!isOpen || !user) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2"><Key className="w-5 h-5" /> Şifre Sıfırla</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-sm text-muted-foreground mb-4"><b>{user.fullName}</b> için yeni şifre belirleyin.</p>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <PasswordInput placeholder="Yeni Şifre (min 6 karakter)" value={password}
                        onChange={(e) => setPassword(e.target.value)} minLength={6} />
                    <PasswordInput placeholder="Şifre Tekrar" value={confirm}
                        onChange={(e) => setConfirm(e.target.value)} />
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">İptal</button>
                        <button type="submit" disabled={resetMutation.isPending}
                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                            {resetMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Sıfırla'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ===== ADD LEAVE MODAL =====
function AddLeaveModal({ isOpen, onClose, users }) {
    const queryClient = useQueryClient();
    const [form, setForm] = useState({ userId: '', startDate: '', endDate: '', type: 'annual', note: '' });

    const addLeaveMutation = useMutation({
        mutationFn: (data) => usersApi.addLeave(data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leaves'] }); toast.success('İzin eklendi'); onClose(); },
        onError: () => toast.error('İzin eklenemedi')
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.userId || !form.startDate || !form.endDate) return toast.error('Tüm alanları doldurun');
        addLeaveMutation.mutate(form);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarPlus className="w-5 h-5" /> İzin Ekle</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none">
                        <option value="">Personel Seçin...</option>
                        {users?.map(u => <option key={u.uid || u.id} value={u.uid || u.id}>{u.fullName}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm text-muted-foreground">Başlangıç</label>
                            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none" />
                        </div>
                        <div>
                            <label className="text-sm text-muted-foreground">Bitiş</label>
                            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none" />
                        </div>
                    </div>
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none">
                        {leaveTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <input type="text" placeholder="Not (opsiyonel)" value={form.note}
                        onChange={(e) => setForm({ ...form, note: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none" />
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">İptal</button>
                        <button type="submit" disabled={addLeaveMutation.isPending}
                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                            {addLeaveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Ekle'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// EditUserModal - Kullanıcı düzenleme
function EditUserModal({ isOpen, onClose, user }) {
    const [formData, setFormData] = useState({
        fullName: user?.fullName || '',
        email: user?.email || '',
        role: user?.role || 'user'
    });
    const queryClient = useQueryClient();

    const updateMutation = useMutation({
        mutationFn: (data) => usersApi.update(user?.uid || user?.id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('Kullanıcı güncellendi'); onClose(); },
        onError: (e) => toast.error(e.message || 'Güncelleme başarısız')
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        updateMutation.mutate(formData);
    };

    if (!isOpen || !user) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Kullanıcı Düzenle</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Ad Soyad</label>
                        <input type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">E-posta</label>
                        <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Rol</label>
                        <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none">
                            <option value="admin">Yönetici</option>
                            <option value="user">Personel</option>
                        </select>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">İptal</button>
                        <button type="submit" disabled={updateMutation.isPending}
                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                            {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Güncelle
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function Users() {
    const [search, setSearch] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [resetPasswordUser, setResetPasswordUser] = useState(null);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [activeTab, setActiveTab] = useState('users');
    const queryClient = useQueryClient();

    const { data: users, isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: () => usersApi.list().then(res => res.data)
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => usersApi.delete(id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('Kullanıcı silindi'); setDeleteTarget(null); },
        onError: () => { toast.error('Silme başarısız'); setDeleteTarget(null); }
    });

    const toggleMutation = useMutation({
        mutationFn: ({ id, disabled }) => usersApi.update(id, { isActive: !disabled }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('Durum güncellendi'); }
    });

    // Leaves
    const { data: leaves } = useQuery({ queryKey: ['leaves'], queryFn: () => usersApi.getLeaves?.().then(r => r.data).catch(() => []) });
    const deleteLeaveMutation = useMutation({
        mutationFn: (id) => usersApi.deleteLeave?.(id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leaves'] }); toast.success('İzin silindi'); }
    });

    const filteredUsers = users?.filter(u =>
        u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
    ) || [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div><h1 className="text-2xl font-bold">Kullanıcılar & Personel</h1><p className="text-muted-foreground">{users?.length || 0} kullanıcı</p></div>
                <div className="flex gap-2">
                    {activeTab === 'leaves' && (
                        <button onClick={() => setShowLeaveModal(true)} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted">
                            <CalendarPlus className="w-4 h-4" /> İzin Ekle
                        </button>
                    )}
                    {activeTab === 'users' && (
                        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                            <Plus className="w-5 h-5" /> Yeni Kullanıcı
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
                <button onClick={() => setActiveTab('users')}
                    className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px',
                        activeTab === 'users' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                    <User className="w-4 h-4" /> Kullanıcılar
                </button>
                <button onClick={() => setActiveTab('leaves')}
                    className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px',
                        activeTab === 'leaves' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                    <Calendar className="w-4 h-4" /> Personel İzinleri
                </button>
            </div>

            {activeTab === 'users' && (<>
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Kullanıcı ara..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                </div>

                {isLoading ? (
                    <SkeletonTable rows={6} columns={5} />
                ) : (
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-sm font-medium">Kullanıcı</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium">Rol</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium">Durum</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium">Kayıt</th>
                                    <th className="text-right px-4 py-3 text-sm font-medium">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredUsers.map(user => (
                                    <tr key={user.uid || user.id} className="hover:bg-muted/30">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                                                    {getInitials(user.fullName)}
                                                </div>
                                                <div>
                                                    <p className="font-medium">{user.fullName}</p>
                                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn('px-2 py-1 rounded text-xs font-medium',
                                                user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                                            )}>
                                                {getRoleLabel(user.role)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn('px-2 py-1 rounded text-xs font-medium',
                                                user.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                            )}>
                                                {user.isActive ? 'Aktif' : 'Pasif'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(user.createdAt)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => setResetPasswordUser(user)}
                                                    className="p-2 hover:bg-yellow-100 text-yellow-600 rounded-lg" title="Şifre Sıfırla">
                                                    <Key className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => toggleMutation.mutate({ id: user.uid || user.id, disabled: user.isActive })}
                                                    className={cn('p-2 rounded-lg', user.isActive ? 'hover:bg-red-100 text-red-600' : 'hover:bg-green-100 text-green-600')}>
                                                    {user.isActive ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                                                </button>
                                                <button onClick={() => setEditingUser(user)} className="p-2 hover:bg-muted rounded-lg" title="Düzenle"><Edit className="w-4 h-4" /></button>
                                                <button onClick={() => setDeleteTarget(user)} className="p-2 hover:bg-red-100 text-red-600 rounded-lg" title="Sil">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </>)}

            {/* Leaves Tab */}
            {activeTab === 'leaves' && (
                <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left px-4 py-3 font-medium">Personel</th>
                                <th className="text-left px-4 py-3 font-medium">Tarih</th>
                                <th className="text-left px-4 py-3 font-medium">Tür</th>
                                <th className="text-left px-4 py-3 font-medium">Not</th>
                                <th className="text-right px-4 py-3 font-medium">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {(leaves || []).map(lv => {
                                const lt = leaveTypes.find(t => t.value === lv.type);
                                return (
                                    <tr key={lv.id} className="hover:bg-muted/30">
                                        <td className="px-4 py-3 font-medium">{lv.userName}</td>
                                        <td className="px-4 py-3">{formatDate(lv.startDate)} - {formatDate(lv.endDate)}</td>
                                        <td className="px-4 py-3">
                                            <span className={cn('px-2 py-1 rounded text-xs font-medium', lt?.color)}>{lt?.label || lv.type}</span>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">{lv.note || '-'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => deleteLeaveMutation.mutate(lv.id)}
                                                className="p-1.5 text-red-500 hover:bg-red-500/10 rounded"><Trash2 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {(!leaves || leaves.length === 0) && (
                                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Henüz izin kaydı yok</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <AddUserModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
            <EditUserModal isOpen={!!editingUser} onClose={() => setEditingUser(null)} user={editingUser} />
            <ResetPasswordModal isOpen={!!resetPasswordUser} onClose={() => setResetPasswordUser(null)} user={resetPasswordUser} />
            <AddLeaveModal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} users={users} />
            <ConfirmDialog
                open={!!deleteTarget}
                title="Kullanıcıyı Sil"
                message={`"${deleteTarget?.fullName}" kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
                confirmLabel="Evet, Sil"
                variant="danger"
                loading={deleteMutation.isPending}
                onConfirm={() => deleteMutation.mutate(deleteTarget?.uid || deleteTarget?.id)}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}

import { useState, useEffect } from 'react';
import {
    Plus, Search, Edit, Trash2, X, Save, Building, Users, FolderOpen,
    Loader2, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { creatorApi } from '../services/creatorApi';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Organizations() {
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingOrg, setEditingOrg] = useState(null);
    const [formData, setFormData] = useState({ name: '', owner: '', slug: '' });
    const [deleteTarget, setDeleteTarget] = useState(null);

    useEffect(() => { loadOrganizations(); }, []);

    async function loadOrganizations() {
        setLoading(true);
        try {
            const result = await creatorApi.listOrganizations();
            setOrganizations(result?.organizations || []);
        } catch (error) {
            console.error('Load organizations error:', error);
            toast.error('Organizasyonlar yüklenemedi');
        } finally {
            setLoading(false);
        }
    }

    function openCreateModal() {
        setEditingOrg(null);
        setFormData({ name: '', owner: '', slug: '' });
        setShowModal(true);
    }

    function openEditModal(org) {
        setEditingOrg(org);
        setFormData({
            name: org.name || '',
            owner: org.owner || '',
            slug: org.slug || ''
        });
        setShowModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
            if (editingOrg) {
                await creatorApi.updateOrganization(editingOrg.id, formData);
                toast.success('Organizasyon güncellendi!');
            } else {
                await creatorApi.createOrganization(formData);
                toast.success('Organizasyon oluşturuldu!');
            }
            setShowModal(false);
            loadOrganizations();
        } catch (error) {
            toast.error('Hata: ' + error.message);
        }
    }

    function handleDelete(org) {
        setDeleteTarget(org);
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            await creatorApi.deleteOrganization(deleteTarget.id);
            toast.success('Organizasyon silindi!');
            setDeleteTarget(null);
            loadOrganizations();
        } catch (error) {
            toast.error('Silme hatası: ' + error.message);
        }
    }

    const filtered = organizations.filter(org => {
        const s = searchTerm.toLowerCase();
        return (org.name || '').toLowerCase().includes(s) || (org.owner || '').toLowerCase().includes(s);
    });

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Organizasyonlar</h1>
                <button className="btn btn-primary" onClick={openCreateModal}>
                    <Plus size={18} /> Yeni Organizasyon
                </button>
            </div>

            <div style={{ marginBottom: '24px' }}>
                <div style={{ position: 'relative', maxWidth: '400px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text" className="form-input" placeholder="Organizasyon ara..."
                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '44px' }}
                    />
                </div>
            </div>

            {loading ? (
                <div className="loader"><div className="loader-spinner"></div></div>
            ) : filtered.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                    <Building size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                    <p style={{ color: 'var(--text-muted)' }}>
                        {searchTerm ? 'Arama sonucu bulunamadı.' : 'Henüz organizasyon oluşturulmamış.'}
                    </p>
                </div>
            ) : (
                <div className="studio-list">
                    {filtered.map(org => (
                        <div key={org.id} className="studio-card">
                            <div className="studio-info">
                                <div className="studio-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                                    <Building size={20} color="#fff" />
                                </div>
                                <div className="studio-details">
                                    <h3>{org.name}</h3>
                                    <p>
                                        <Users size={12} style={{ marginRight: '4px' }} />
                                        {org.owner || 'Sahip yok'}
                                        {org.studioCount !== undefined && (
                                            <span style={{ marginLeft: '12px' }}>
                                                <FolderOpen size={12} style={{ marginRight: '4px' }} />
                                                {org.studioCount} stüdyo
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button className="btn btn-secondary btn-sm" title="Düzenle" onClick={() => openEditModal(org)}>
                                    <Edit size={14} />
                                </button>
                                <button className="btn btn-danger btn-sm" title="Sil" onClick={() => handleDelete(org)}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingOrg ? 'Organizasyonu Düzenle' : 'Yeni Organizasyon'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Organizasyon Adı *</label>
                                    <input type="text" className="form-input" required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Acme Photography Group"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Sahip / Kurucu</label>
                                    <input type="text" className="form-input"
                                        value={formData.owner}
                                        onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                                        placeholder="Ali Yılmaz"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Slug (URL-safe ID)</label>
                                    <input type="text" className="form-input"
                                        value={formData.slug}
                                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                        placeholder="acme-photography"
                                    />
                                    <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                        Boş bırakılırsa otomatik oluşturulur
                                    </small>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>İptal</button>
                                <button type="submit" className="btn btn-primary">
                                    <Save size={16} /> {editingOrg ? 'Güncelle' : 'Oluştur'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDelete}
                title="Organizasyonu Sil"
                message={deleteTarget ? `"${deleteTarget.name}" organizasyonu ve tüm bağlı stüdyolar kalıcı olarak silinecektir. Devam etmek için aşağıya organizasyon adını yazın.` : ''}
                confirmText="Sil"
                cancelText="Vazgeç"
                danger
                requireText={deleteTarget?.name || ''}
            />
        </div>
    );
}

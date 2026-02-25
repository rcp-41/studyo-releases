import { useState, useEffect } from 'react';
import {
    Plus, Search, Edit, Eye, EyeOff, RefreshCcw, Pause, Play, Trash2, X, Key,
    Settings, Camera, MapPin, User, Save, Globe, Lock, Wifi, WifiOff, Loader2
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, addDoc, query, where, writeBatch } from 'firebase/firestore';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { creatorApi } from '../services/creatorApi';

// SECURITY: Generate random license key using crypto.getRandomValues
function generateLicenseKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = 4;
    const segmentLength = 4;
    const randomValues = new Uint8Array(segments * segmentLength);
    crypto.getRandomValues(randomValues);
    let key = [];
    for (let s = 0; s < segments; s++) {
        let segment = '';
        for (let c = 0; c < segmentLength; c++) {
            segment += chars.charAt(randomValues[s * segmentLength + c] % chars.length);
        }
        key.push(segment);
    }
    return key.join('-');
}

// Generate studio ID from name
function generateStudioId(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        + '-' + Date.now().toString(36);
}

export default function Studios() {
    const [studios, setStudios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [showHwidModal, setShowHwidModal] = useState(null);
    const [activeTab, setActiveTab] = useState('general');
    const [editingStudio, setEditingStudio] = useState(null);
    const [showPasswords, setShowPasswords] = useState({ admin: false, user: false });

    // WhatsApp Status per studio
    const [waStatus, setWaStatus] = useState(null);
    const [waLoading, setWaLoading] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        // General
        name: '',
        owner: '',
        contact: '',
        email: '',
        ownerEmail: '',
        // Integrations
        wc_url: '',
        wc_consumer_key: '',
        wc_consumer_secret: ''
    });

    // Options Data (for editing only)
    const [optionsData, setOptionsData] = useState({
        shootTypes: [],
        locations: [],
        photographers: []
    });
    const [newOption, setNewOption] = useState({ type: 'shootTypes', name: '', price: '' });

    useEffect(() => {
        loadStudios();
    }, []);

    async function loadStudios() {
        setLoading(true);
        try {
            const snapshot = await getDocs(collection(db, 'studios'));
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setStudios(data);
        } catch (error) {
            console.error('Load studios error:', error);
        } finally {
            setLoading(false);
        }
    }

    // Load options for a specific studio
    async function loadStudioOptions(studioId) {
        try {
            const [shootTypesSnap, locationsSnap, photographersSnap] = await Promise.all([
                getDocs(collection(db, 'studios', studioId, 'shootTypes')),
                getDocs(collection(db, 'studios', studioId, 'locations')),
                getDocs(collection(db, 'studios', studioId, 'photographers'))
            ]);

            setOptionsData({
                shootTypes: shootTypesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                locations: locationsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                photographers: photographersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            });
        } catch (error) {
            console.error('Error loading options:', error);
        }
    }

    function openCreateModal() {
        setEditingStudio(null);
        setFormData({
            name: '', owner: '', contact: '', email: '', ownerEmail: '',
            wc_url: '', wc_consumer_key: '', wc_consumer_secret: ''
        });
        setActiveTab('general');
        setShowModal(true);
    }

    function openEditModal(studio) {
        setEditingStudio(studio);
        setFormData({
            name: studio.info?.name || '',
            owner: studio.info?.owner || '',
            contact: studio.info?.contact || '',
            email: studio.info?.email || '',
            wc_url: studio.integrations?.woocommerce?.url || '',
            wc_consumer_key: studio.integrations?.woocommerce?.consumer_key || '',
            wc_consumer_secret: studio.integrations?.woocommerce?.consumer_secret || ''
        });
        loadStudioOptions(studio.id);
        setActiveTab('general');
        setShowModal(true);
    }

    async function handleSaveStudio(e) {
        e.preventDefault();

        try {
            if (editingStudio) {
                // Update existing studio (direct Firestore update is OK)
                const studioData = {
                    'info.name': formData.name,
                    'info.owner': formData.owner,
                    'info.contact': formData.contact,
                    'info.email': formData.email,
                    'integrations.woocommerce': {
                        url: formData.wc_url,
                        consumer_key: formData.wc_consumer_key,
                        consumer_secret: formData.wc_consumer_secret
                    },
                    updatedAt: serverTimestamp()
                };
                await updateDoc(doc(db, 'studios', editingStudio.id), studioData);
                toast.success('Stüdyo güncellendi!');
            } else {
                // Create new studio via Cloud Function (creates Auth users!)
                if (!formData.adminPassword || formData.adminPassword.length < 8) {
                    toast.error('Yönetici şifresi en az 8 karakter olmalı!');
                    return;
                }
                if (!formData.userPassword || formData.userPassword.length < 8) {
                    toast.error('Personel şifresi en az 8 karakter olmalı!');
                    return;
                }

                const licenseKey = generateLicenseKey();
                const result = await creatorApi.createStudio({
                    name: formData.name,
                    ownerName: formData.owner,
                    contactEmail: formData.ownerEmail || formData.email,
                    phone: formData.contact,
                    adminPassword: formData.adminPassword,
                    userPassword: formData.userPassword,
                    licenseKey: licenseKey,
                    hwidLock: false
                });

                if (result.success) {
                    toast.success(`Stüdyo oluşturuldu! ID: ${result.studioId}`);

                    // Now update with WooCommerce settings if provided
                    if (formData.wc_url) {
                        await updateDoc(doc(db, 'studios', result.studioId), {
                            'integrations.woocommerce': {
                                url: formData.wc_url,
                                consumer_key: formData.wc_consumer_key,
                                consumer_secret: formData.wc_consumer_secret
                            }
                        });
                    }
                }
            }

            setShowModal(false);
            loadStudios();
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Kaydedilirken hata oluştu: ' + error.message);
        }
    }

    async function handleAddOption() {
        if (!newOption.name || !editingStudio) return;

        try {
            const collectionName = newOption.type;
            const data = { name: newOption.name };
            if (collectionName === 'shootTypes' && newOption.price) {
                data.price = parseFloat(newOption.price);
            }

            await addDoc(collection(db, 'studios', editingStudio.id, collectionName), data);

            setNewOption({ ...newOption, name: '', price: '' });
            loadStudioOptions(editingStudio.id);
        } catch (error) {
            console.error('Add option error:', error);
            alert('Eklenemedi: ' + error.message);
        }
    }

    async function handleDeleteOption(type, id) {
        if (!editingStudio || !confirm('Silmek istediğine emin misin?')) return;

        try {
            await deleteDoc(doc(db, 'studios', editingStudio.id, type, id));
            loadStudioOptions(editingStudio.id);
        } catch (error) {
            console.error('Delete option error:', error);
        }
    }

    async function handleToggleStatus(studio) {
        const newStatus = studio.info?.subscription_status === 'active' ? 'suspended' : 'active';
        try {
            await updateDoc(doc(db, 'studios', studio.id), {
                'info.subscription_status': newStatus,
                updatedAt: serverTimestamp()
            });
            loadStudios();
        } catch (error) {
            console.error('Toggle status error:', error);
        }
    }

    async function handleResetHwid(studio) {
        if (!confirm(`${studio.info?.name} için HWID sıfırlansın mı?`)) return;

        try {
            await updateDoc(doc(db, 'studios', studio.id), {
                'license.hwid_lock': null,
                'license.mac_address': null,
                'license.registered_at': null,
                updatedAt: serverTimestamp()
            });
            loadStudios();
            setShowHwidModal(null);
        } catch (error) {
            console.error('Reset HWID error:', error);
        }
    }

    async function handleDeleteStudio(studio) {
        if (!confirm(`${studio.info?.name} silinecek. Bu işlem geri alınamaz! Devam edilsin mi?`)) return;

        try {
            // SECURITY: Use Cloud Function for cascade delete (subcollections + Auth users)
            await creatorApi.deleteStudio(studio.id);
            toast.success('Stüdyo silindi!');
            loadStudios();
        } catch (error) {
            console.error('Delete studio error:', error);
            toast.error('Stüdyo silme başarısız: ' + error.message);
        }
    }

    // Build Mutation
    const buildMutation = useMutation({
        mutationFn: (data) => creatorApi.triggerBuild(data.id, data.name),
        onSuccess: (data) => {
            toast.success('Build ve Upload başlatıldı! (Konsola bakınız)');
            // Gerçek zamanlı log izleme şu an yok, ama işlem bitince Firestore güncellenecek
            // Linkin gelmesi için birkaç saniye bekleyip yenilemek gerekir veya Firestore listener gerekir.
            // Şimdilik basitçe invalidate ediyoruz.
            setTimeout(() => {
                queryClient.invalidateQueries(['studios']);
                toast.success('Listeyi yeniledim.');
            }, 5000);
        },
        onError: (error) => {
            toast.error('Build Hatası: ' + error.message);
        }
    });

    const filteredStudios = studios.filter(studio => {
        const searchLower = searchTerm.toLowerCase();
        return (
            studio.info?.name?.toLowerCase().includes(searchLower) ||
            studio.info?.owner?.toLowerCase().includes(searchLower) ||
            studio.id.toLowerCase().includes(searchLower)
        );
    });

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Stüdyolar</h1>
                <button className="btn btn-primary" onClick={openCreateModal}>
                    <Plus size={18} />
                    Yeni Stüdyo
                </button>
            </div>

            {/* Search */}
            <div style={{ marginBottom: '24px' }}>
                <div style={{ position: 'relative', maxWidth: '400px' }}>
                    <Search
                        size={18}
                        style={{
                            position: 'absolute', left: '14px', top: '50%',
                            transform: 'translateY(-50%)', color: 'var(--text-muted)'
                        }}
                    />
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Stüdyo ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '44px' }}
                    />
                </div>
            </div>

            {/* Studios List */}
            {loading ? (
                <div className="loader"><div className="loader-spinner"></div></div>
            ) : filteredStudios.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                    <p style={{ color: 'var(--text-muted)' }}>
                        {searchTerm ? 'Arama sonucu bulunamadı.' : 'Henüz stüdyo eklenmemiş.'}
                    </p>
                </div>
            ) : (
                <div className="studio-list">
                    {filteredStudios.map(studio => (
                        <div key={studio.id} className="studio-card">
                            <div className="studio-info">
                                <div className="studio-icon">📷</div>
                                <div className="studio-details">
                                    <h3>{studio.info?.name || 'İsimsiz'}</h3>
                                    <p>
                                        {studio.info?.owner || 'Sahip yok'} |
                                        HWID: {studio.license?.hwid_lock ? '🔒 Kayıtlı' : '⏳ Bekliyor'}
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <span className={`studio-status ${studio.info?.subscription_status || 'inactive'}`}>
                                    {studio.info?.subscription_status === 'active' ? '✅ Aktif' : '⏸️ Askıda'}
                                </span>

                                <div className="studio-actions">
                                    <button className="btn btn-secondary btn-sm" title="Düzenle" onClick={() => openEditModal(studio)}>
                                        <Edit size={14} />
                                    </button>
                                    <button className="btn btn-secondary btn-sm" title="HWID Ayarları" onClick={() => setShowHwidModal(studio)}>
                                        <Key size={14} />
                                    </button>
                                    <button className="btn btn-secondary btn-sm" title="Durum Değiştir" onClick={() => handleToggleStatus(studio)}>
                                        {studio.info?.subscription_status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                                    </button>
                                    <button className="btn btn-danger btn-sm" title="Sil" onClick={() => handleDeleteStudio(studio)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingStudio ? 'Stüdyoyu Düzenle' : 'Yeni Stüdyo Oluştur'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="tabs">
                            <button
                                className={`tab ${activeTab === 'general' ? 'active' : ''}`}
                                onClick={() => setActiveTab('general')}
                            >
                                <Settings size={16} /> Genel
                            </button>

                            {editingStudio && (
                                <button
                                    className={`tab ${activeTab === 'options' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('options')}
                                >
                                    <Camera size={16} /> Çekim Seçenekleri
                                </button>
                            )}
                            {editingStudio && (
                                <button
                                    className={`tab ${activeTab === 'whatsapp' ? 'active' : ''}`}
                                    onClick={async () => {
                                        setActiveTab('whatsapp');
                                        if (!waStatus) {
                                            setWaLoading(true);
                                            try {
                                                const res = await creatorApi.getWhatsappStatus(editingStudio.id);
                                                setWaStatus(res.status);
                                            } catch { setWaStatus(null); }
                                            setWaLoading(false);
                                        }
                                    }}
                                >
                                    <Wifi size={16} /> WhatsApp
                                </button>
                            )}
                            {editingStudio && (
                                <button
                                    className={`tab ${activeTab === 'integrations' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('integrations')}
                                >
                                    <Globe size={16} /> Entegrasyonlar
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleSaveStudio}>
                            <div className="modal-body">

                                {/* GENERAL TAB */}
                                {activeTab === 'general' && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Stüdyo Adı *</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Sahip Adı</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={formData.owner}
                                                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">E-posta</label>
                                            <input
                                                type="email"
                                                className="form-input"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Yönetici E-posta</label>
                                            <input
                                                type="email"
                                                required
                                                className="form-input"
                                                value={formData.ownerEmail}
                                                onChange={e => setFormData({ ...formData, ownerEmail: e.target.value })}
                                                placeholder="ahmet@example.com"
                                            />
                                        </div>

                                        {/* Password fields — only shown when creating new studio */}
                                        {!editingStudio && (
                                            <>
                                                <div className="form-group">
                                                    <label className="form-label">Yönetici Şifresi *</label>
                                                    <div style={{ position: 'relative' }}>
                                                        <input
                                                            type={showPasswords.admin ? 'text' : 'password'}
                                                            required
                                                            minLength={8}
                                                            className="form-input"
                                                            style={{ paddingRight: '40px' }}
                                                            value={formData.adminPassword || ''}
                                                            onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                                                            placeholder="Min. 8 karakter"
                                                        />
                                                        <button type="button" onClick={() => setShowPasswords(p => ({ ...p, admin: !p.admin }))} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                                                            {showPasswords.admin ? <EyeOff size={16} /> : <Eye size={16} />}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Personel Şifresi *</label>
                                                    <div style={{ position: 'relative' }}>
                                                        <input
                                                            type={showPasswords.user ? 'text' : 'password'}
                                                            required
                                                            minLength={8}
                                                            className="form-input"
                                                            style={{ paddingRight: '40px' }}
                                                            value={formData.userPassword || ''}
                                                            onChange={e => setFormData({ ...formData, userPassword: e.target.value })}
                                                            placeholder="Min. 8 karakter"
                                                        />
                                                        <button type="button" onClick={() => setShowPasswords(p => ({ ...p, user: !p.user }))} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                                                            {showPasswords.user ? <EyeOff size={16} /> : <Eye size={16} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        <div className="form-group">
                                            <label className="form-label">Telefon</label>
                                            <input
                                                type="tel"
                                                className="form-input"
                                                value={formData.contact}
                                                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                                            />
                                        </div>

                                    </>
                                )}



                                {/* OPTIONS TAB */}
                                {activeTab === 'options' && (
                                    <div className="options-manager">
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                            <select
                                                className="form-input"
                                                value={newOption.type}
                                                onChange={e => setNewOption({ ...newOption, type: e.target.value })}
                                            >
                                                <option value="shootTypes">Çekim Türleri</option>
                                                <option value="locations">Çekim Yerleri</option>
                                                <option value="photographers">Çekimciler</option>
                                            </select>
                                            <input
                                                className="form-input"
                                                placeholder="İsim"
                                                value={newOption.name}
                                                onChange={e => setNewOption({ ...newOption, name: e.target.value })}
                                            />
                                            {newOption.type === 'shootTypes' && (
                                                <input
                                                    className="form-input"
                                                    type="number"
                                                    placeholder="Fiyat"
                                                    style={{ width: '80px' }}
                                                    value={newOption.price}
                                                    onChange={e => setNewOption({ ...newOption, price: e.target.value })}
                                                />
                                            )}

                                            <button type="button" className="btn btn-primary" onClick={handleAddOption}>
                                                <Plus size={16} />
                                            </button>
                                        </div>

                                        <div className="options-list">
                                            {/* Shoot Types */}
                                            <div className="options-section">
                                                <h4><Camera size={14} /> Çekim Türleri</h4>
                                                {optionsData.shootTypes.map(opt => (
                                                    <div key={opt.id} className="option-item">
                                                        <span>{opt.name} {opt.price && `(₺${opt.price})`}</span>
                                                        <button type="button" onClick={() => handleDeleteOption('shootTypes', opt.id)}>
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Locations */}
                                            <div className="options-section">
                                                <h4><MapPin size={14} /> Mekanlar</h4>
                                                {optionsData.locations.map(opt => (
                                                    <div key={opt.id} className="option-item">
                                                        <span>{opt.name}</span>
                                                        <button type="button" onClick={() => handleDeleteOption('locations', opt.id)}>
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Photographers */}
                                            <div className="options-section">
                                                <h4><User size={14} /> Çekimciler</h4>
                                                {optionsData.photographers.map(opt => (
                                                    <div key={opt.id} className="option-item">
                                                        <span>{opt.name}</span>
                                                        <button type="button" onClick={() => handleDeleteOption('photographers', opt.id)}>
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* INTEGRATIONS TAB */}
                                {activeTab === 'integrations' && editingStudio && (
                                    <div style={{ padding: '8px 0' }}>
                                        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Globe size={18} /> WooCommerce Ayarları
                                        </h3>
                                        <div className="form-group">
                                            <label className="form-label">WooCommerce URL</label>
                                            <input
                                                type="url"
                                                className="form-input"
                                                value={formData.wc_url}
                                                onChange={(e) => setFormData({ ...formData, wc_url: e.target.value })}
                                                placeholder="https://example.com"
                                            />
                                            <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                                WooCommerce mağaza URL'si (https:// ile başlamalı)
                                            </small>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Consumer Key</label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type={showPasswords.wcKey ? 'text' : 'password'}
                                                    className="form-input"
                                                    style={{ paddingRight: '40px', fontFamily: 'monospace', fontSize: '13px' }}
                                                    value={formData.wc_consumer_key}
                                                    onChange={(e) => setFormData({ ...formData, wc_consumer_key: e.target.value })}
                                                    placeholder="ck_..."
                                                />
                                                <button type="button" onClick={() => setShowPasswords(p => ({ ...p, wcKey: !p.wcKey }))} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                                                    {showPasswords.wcKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Consumer Secret</label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type={showPasswords.wcSecret ? 'text' : 'password'}
                                                    className="form-input"
                                                    style={{ paddingRight: '40px', fontFamily: 'monospace', fontSize: '13px' }}
                                                    value={formData.wc_consumer_secret}
                                                    onChange={(e) => setFormData({ ...formData, wc_consumer_secret: e.target.value })}
                                                    placeholder="cs_..."
                                                />
                                                <button type="button" onClick={() => setShowPasswords(p => ({ ...p, wcSecret: !p.wcSecret }))} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                                                    {showPasswords.wcSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                        {formData.wc_url && (
                                            <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'var(--bg-hover)', fontSize: '13px' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Durum: </span>
                                                {formData.wc_url && formData.wc_consumer_key && formData.wc_consumer_secret
                                                    ? <span style={{ color: 'var(--success)', fontWeight: 500 }}>✅ Yapılandırıldı</span>
                                                    : <span style={{ color: 'var(--warning)', fontWeight: 500 }}>⚠️ Eksik bilgi</span>
                                                }
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* WHATSAPP TAB */}
                                {activeTab === 'whatsapp' && editingStudio && (
                                    <div style={{ padding: '8px 0' }}>
                                        {waLoading ? (
                                            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                                                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
                                            </div>
                                        ) : waStatus ? (
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                                    {waStatus.connected
                                                        ? <><Wifi size={20} color="#22c55e" /><span style={{ color: '#22c55e', fontWeight: 600 }}>Bağlı</span></>
                                                        : <><WifiOff size={20} color="#ef4444" /><span style={{ color: '#ef4444', fontWeight: 600 }}>Bağlı Değil</span></>}
                                                </div>
                                                {waStatus.phone && (
                                                    <div className="form-group">
                                                        <label className="form-label">Telefon Numarası</label>
                                                        <input type="text" className="form-input" value={waStatus.phone} disabled />
                                                    </div>
                                                )}
                                                {waStatus.lastSeen && (
                                                    <div className="form-group">
                                                        <label className="form-label">Son Görülme</label>
                                                        <input type="text" className="form-input" value={new Date(waStatus.lastSeen).toLocaleString('tr-TR')} disabled />
                                                    </div>
                                                )}
                                                {waStatus.qr && !waStatus.connected && (
                                                    <div style={{ marginTop: '16px', textAlign: 'center' }}>
                                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>WhatsApp bağlamak için QR kodu okutun:</p>
                                                        <img src={waStatus.qr} alt="WhatsApp QR" style={{ maxWidth: '200px', borderRadius: '8px' }} />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                                <WifiOff size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                                                <p>Bu stüdyo için WhatsApp durumu bulunamadı.</p>
                                                <p style={{ fontSize: '12px', marginTop: '8px' }}>Stüdyo panelinden WhatsApp bağlantısı yapılmalıdır.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    Kapat
                                </button>
                                {activeTab !== 'options' && activeTab !== 'whatsapp' && (
                                    <button type="submit" className="btn btn-primary">
                                        <Save size={16} />
                                        Kaydet
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* HWID Modal - Kept same as before */}
            {showHwidModal && (
                <div className="modal-overlay" onClick={() => setShowHwidModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>HWID Bilgileri</h2>
                            <button className="modal-close" onClick={() => setShowHwidModal(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Stüdyo</label>
                                <input type="text" className="form-input" value={showHwidModal.info?.name} disabled />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Lisans Anahtarı</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={showHwidModal.license?.license_key || 'Yok'}
                                    disabled
                                    style={{ fontFamily: 'monospace' }}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">HWID</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={showHwidModal.license?.hwid_lock || 'Kayıt yapılmadı'}
                                    disabled
                                    style={{ fontFamily: 'monospace' }}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">MAC Adresi</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={showHwidModal.license?.mac_address || 'Kayıt yapılmadı'}
                                    disabled
                                    style={{ fontFamily: 'monospace' }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowHwidModal(null)}>
                                Kapat
                            </button>
                            <button className="btn btn-danger" onClick={() => handleResetHwid(showHwidModal)}>
                                <RefreshCcw size={16} />
                                HWID Sıfırla
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

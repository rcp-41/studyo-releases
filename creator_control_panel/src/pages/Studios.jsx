import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Plus, Search, Edit, Eye, EyeOff, RefreshCcw, Pause, Play, Trash2, X, Key,
    Settings, Camera, MapPin, User, Save, Globe, Lock, Wifi, WifiOff, Loader2,
    Building, Shield, RotateCcw, ChevronDown, ChevronRight, Monitor, Bell,
    CheckCircle, XCircle, Clock, Database, Copy, ArrowRightLeft, Download, HardDrive
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, onSnapshot, query, where, getFirestore, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import toast from 'react-hot-toast';
import { creatorApi } from '../services/creatorApi';
import BotConfigModal from '../components/BotConfigModal';
import ConfirmDialog from '../components/ConfirmDialog';
import PlanChangeModal, { PlanBadge } from '../components/PlanChangeModal';
import SuspendModal from '../components/SuspendModal';
import SubscriptionModal from '../components/SubscriptionModal';
import CouponApplyModal from '../components/CouponApplyModal';
import CloneStudioModal from '../components/CloneStudioModal';
import MoveStudioModal from '../components/MoveStudioModal';
import ExportModal from '../components/ExportModal';
import BackupPanel from '../components/BackupPanel';

const SECRET_MASK = '••••••••';

// E1: Relative time display for last login
function formatLastLogin(lastLoginAt) {
    if (!lastLoginAt) return null;
    // Support both Firestore Timestamp (with toDate) and ISO string
    const date = lastLoginAt?.toDate ? lastLoginAt.toDate() : new Date(lastLoginAt);
    if (isNaN(date.getTime())) return null;
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Az önce';
    if (diffMin < 60) return `${diffMin} dakika önce`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} saat önce`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 30) return `${diffD} gün önce`;
    return date.toLocaleDateString('tr-TR');
}

// B1/B3: Subscription expiry badge
function SubscriptionBadge({ subscription }) {
    if (!subscription?.expiresAt) return null;
    const expiresDate = subscription.expiresAt?.toDate
        ? subscription.expiresAt.toDate()
        : new Date(subscription.expiresAt);
    if (isNaN(expiresDate.getTime())) return null;

    const now = new Date();
    const diffMs = expiresDate - now;
    const diffDays = Math.ceil(diffMs / 86400000);

    const status = subscription.status;
    let color = '#22c55e';
    let label = '';

    if (status === 'trial') {
        label = `Deneme: ${diffDays > 0 ? diffDays + ' gün kaldı' : 'Süresi doldu'}`;
        color = '#8b5cf6';
    } else if (status === 'grace_period') {
        label = 'Grace period';
        color = '#f59e0b';
    } else if (status === 'expired') {
        label = 'Süresi doldu';
        color = '#ef4444';
    } else if (diffDays <= 0) {
        label = 'Süresi doldu';
        color = '#ef4444';
    } else if (diffDays <= 7) {
        label = `Bitiş: ${diffDays} gün kaldı`;
        color = '#ef4444';
    } else if (diffDays <= 30) {
        label = `Bitiş: ${diffDays} gün kaldı`;
        color = '#f59e0b';
    } else {
        label = `Bitiş: ${expiresDate.toLocaleDateString('tr-TR')}`;
        color = '#22c55e';
    }

    return (
        <span style={{
            fontSize: '11px', fontWeight: 500, padding: '1px 7px', borderRadius: '10px',
            background: color + '18', color, border: `1px solid ${color}33`
        }}>
            {label}
        </span>
    );
}

// A2: Suspension info badge
function SuspensionBadge({ suspension }) {
    if (!suspension?.active) return null;
    return (
        <span style={{ fontSize: '11px', color: '#ef4444', fontStyle: 'italic' }} title={suspension.reason}>
            {suspension.reason?.substring(0, 40)}{suspension.reason?.length > 40 ? '...' : ''}
        </span>
    );
}

export default function Studios() {
    const [studios, setStudios] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsedOrgs, setCollapsedOrgs] = useState({});
    const queryClient = useQueryClient();

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [showHwidModal, setShowHwidModal] = useState(null);
    const [showResetModal, setShowResetModal] = useState(null);
    const [resetOption, setResetOption] = useState('archives');
    const [resetConfirmText, setResetConfirmText] = useState('');
    const [resettingData, setResettingData] = useState(false);
    const [activeTab, setActiveTab] = useState('general');
    const [editingStudio, setEditingStudio] = useState(null);
    const [showPasswords, setShowPasswords] = useState({ admin: false, user: false });

    // Wizard States for New Studio
    const [wizardStep, setWizardStep] = useState(1); // 1 = Org Select/Create, 2 = Studio Info
    const [orgMode, setOrgMode] = useState('select'); // 'select' | 'create'
    const [newOrgData, setNewOrgData] = useState({ name: '', owner: '', slug: '' });
    const [creatingOrg, setCreatingOrg] = useState(false);

    // WhatsApp Status
    const [waStatus, setWaStatus] = useState(null);
    const [waLoading, setWaLoading] = useState(false);

    // Device Management
    const [deviceList, setDeviceList] = useState([]);
    const [deviceLoading, setDeviceLoading] = useState(false);

    // Bot Config Modal
    const [showBotModal, setShowBotModal] = useState(null);

    // Faz 2 modals
    const [showPlanModal, setShowPlanModal] = useState(null);
    const [showSuspendModal, setShowSuspendModal] = useState(null);
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(null);
    const [showCouponModal, setShowCouponModal] = useState(null);

    // Faz 3 modals
    const [showCloneModal, setShowCloneModal] = useState(null);
    const [showMoveModal, setShowMoveModal] = useState(null);
    const [showExportModal, setShowExportModal] = useState(null);
    const [showBackupPanel, setShowBackupPanel] = useState(null);
    const [resetTotpCode, setResetTotpCode] = useState('');

    // Confirm Dialog state
    const [confirmState, setConfirmState] = useState(null);
    const [deviceModalPending, setDeviceModalPending] = useState(false);

    // Secret masking state for WooCommerce credentials
    const [wcSecretState, setWcSecretState] = useState({
        hasStoredKey: false, keyChanged: false, keyVisible: false,
        hasStoredSecret: false, secretChanged: false, secretVisible: false
    });

    // E5: Online user counts per studio { [studioId]: count }
    const [onlineMap, setOnlineMap] = useState({});

    // H4: Update channel modal
    const [showUpdateChannelModal, setShowUpdateChannelModal] = useState(null);
    const [updateChannelValue, setUpdateChannelValue] = useState('stable');
    const [updateMinVersion, setUpdateMinVersion] = useState('');
    const [savingChannel, setSavingChannel] = useState(false);

    // H2: Remote log modal
    const [showRemoteLogModal, setShowRemoteLogModal] = useState(null);
    const [remoteLogRequestId, setRemoteLogRequestId] = useState(null);
    const [remoteLogStatus, setRemoteLogStatus] = useState(null);
    const [remoteLogLoading, setRemoteLogLoading] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        organizationId: '',
        name: '', owner: '', contact: '', email: '', ownerEmail: '',
        wc_url: '', wc_consumer_key: '', wc_consumer_secret: ''
    });

    // E5: Subscribe to onlineUsers subcollections for all loaded studios
    const onlineUnsubsRef = useRef([]);
    useEffect(() => {
        if (studios.length === 0) return;
        // Unsubscribe previous listeners
        onlineUnsubsRef.current.forEach(u => u());
        onlineUnsubsRef.current = [];

        const db = getFirestore();
        const cutoff = new Date(Date.now() - 60000);

        studios.forEach(s => {
            if (!s.organizationId || !s.id) return;
            const onlineRef = collection(
                db,
                'organizations', s.organizationId,
                'studios', s.id,
                'onlineUsers'
            );
            const q = query(onlineRef, where('lastHeartbeatAt', '>=', Timestamp.fromDate(cutoff)));
            const unsub = onSnapshot(q, snap => {
                setOnlineMap(prev => ({ ...prev, [s.id]: snap.size }));
            }, () => {});
            onlineUnsubsRef.current.push(unsub);
        });

        return () => { onlineUnsubsRef.current.forEach(u => u()); };
    }, [studios.length]);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [studiosResult, orgsResult] = await Promise.all([
                creatorApi.getStudiosWithStats(),
                creatorApi.listOrganizations()
            ]);
            setStudios(studiosResult?.studios || []);
            setOrganizations(orgsResult?.organizations || []);
        } catch (error) {
            console.error('Load data error:', error);
            toast.error('Veriler yüklenemedi');
        } finally {
            setLoading(false);
        }
    }

    function openCreateModal() {
        setEditingStudio(null);
        setWizardStep(1);
        setOrgMode('select');
        setNewOrgData({ name: '', owner: '', slug: '' });
        setFormData({
            organizationId: organizations.length === 1 ? organizations[0].id : '',
            name: '', owner: '', contact: '', email: '', ownerEmail: '',
            wc_url: '', wc_consumer_key: '', wc_consumer_secret: ''
        });
        setWcSecretState({
            hasStoredKey: false, keyChanged: false, keyVisible: false,
            hasStoredSecret: false, secretChanged: false, secretVisible: false
        });
        setActiveTab('general');
        setShowModal(true);
    }

    async function handleNextStep(e) {
        e.preventDefault();
        if (orgMode === 'create') {
            if (!newOrgData.name) {
                toast.error('Firma adı zorunludur!');
                return;
            }
            setCreatingOrg(true);
            try {
                const res = await creatorApi.createOrganization(newOrgData);
                if (res?.success) {
                    setFormData(prev => ({ ...prev, organizationId: res.id }));
                    toast.success('Firma oluşturuldu!');
                    await loadData(); // Refresh org list
                    setWizardStep(2);
                } else {
                    toast.error('Firma oluşturulamadı');
                }
            } catch (err) {
                toast.error('Firma oluşturulamadı: ' + err.message);
            } finally {
                setCreatingOrg(false);
            }
        } else {
            if (!formData.organizationId) {
                toast.error('Lütfen bir firma seçin!');
                return;
            }
            setWizardStep(2);
        }
    }

    function openEditModal(studio) {
        setEditingStudio(studio);
        const storedKey = studio.integrations?.woocommerce?.consumer_key || '';
        const storedSecret = studio.integrations?.woocommerce?.consumer_secret || '';
        setFormData({
            organizationId: studio.organizationId || '',
            name: studio.info?.name || '',
            owner: studio.info?.owner || '',
            contact: studio.info?.contact || '',
            email: studio.info?.email || '',
            wc_url: studio.integrations?.woocommerce?.url || '',
            wc_consumer_key: storedKey ? SECRET_MASK : '',
            wc_consumer_secret: storedSecret ? SECRET_MASK : ''
        });
        setWcSecretState({
            hasStoredKey: !!storedKey, keyChanged: false, keyVisible: false,
            hasStoredSecret: !!storedSecret, secretChanged: false, secretVisible: false
        });
        setActiveTab('general');
        setShowModal(true);
    }

    async function handleSaveStudio(e) {
        e.preventDefault();
        try {
            if (editingStudio) {
                const wc = { url: formData.wc_url };
                if (wcSecretState.keyChanged || !wcSecretState.hasStoredKey) {
                    wc.consumer_key = formData.wc_consumer_key;
                }
                if (wcSecretState.secretChanged || !wcSecretState.hasStoredSecret) {
                    wc.consumer_secret = formData.wc_consumer_secret;
                }
                const updateData = {
                    'info.name': formData.name,
                    'info.owner': formData.owner,
                    'info.contact': formData.contact,
                    'info.email': formData.email,
                    'integrations.woocommerce': wc
                };
                await creatorApi.updateStudio(
                    editingStudio.organizationId,
                    editingStudio.id,
                    updateData
                );
                toast.success('Stüdyo güncellendi!');
            } else {
                if (!formData.organizationId) {
                    toast.error('Organizasyon seçilmeli!');
                    return;
                }
                if (!formData.adminPassword || formData.adminPassword.length < 8) {
                    toast.error('Yönetici şifresi en az 8 karakter olmalı!');
                    return;
                }
                if (!formData.userPassword || formData.userPassword.length < 8) {
                    toast.error('Personel şifresi en az 8 karakter olmalı!');
                    return;
                }

                const result = await creatorApi.createStudio({
                    organizationId: formData.organizationId,
                    name: formData.name,
                    ownerName: formData.owner,
                    contactEmail: formData.ownerEmail || formData.email,
                    phone: formData.contact,
                    adminPassword: formData.adminPassword,
                    userPassword: formData.userPassword,
                    hwidLock: false,
                    trialDays: formData.trialDays ? parseInt(formData.trialDays) : undefined
                });

                if (result?.success) {
                    const licenseInfo = result.licenseKey ? ` | Lisans: ${result.licenseKey}` : '';
                    toast.success(`Stüdyo oluşturuldu! ID: ${result.studioId}${licenseInfo}`, { duration: 8000 });
                    // Update WooCommerce if provided
                    if (formData.wc_url && result.studioId) {
                        await creatorApi.updateIntegration(
                            formData.organizationId, result.studioId, 'woocommerce',
                            { url: formData.wc_url, consumer_key: formData.wc_consumer_key, consumer_secret: formData.wc_consumer_secret }
                        );
                    }
                }
            }
            setShowModal(false);
            loadData();
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Kaydedilirken hata oluştu: ' + error.message);
        }
    }

    async function handleToggleStatus(studio) {
        try {
            if (studio.info?.subscription_status === 'active') {
                await creatorApi.suspendStudio(studio.organizationId, studio.id, 'Manual suspend from Creator Panel');
                toast.success('Stüdyo askıya alındı');
            } else {
                await creatorApi.activateStudio(studio.organizationId, studio.id);
                toast.success('Stüdyo aktifleştirildi');
            }
            loadData();
        } catch (error) {
            toast.error('Hata: ' + error.message);
        }
    }

    function handleResetHwid(studio) {
        setConfirmState({
            kind: 'resetHwid',
            title: 'HWID Sıfırla',
            message: `${studio.info?.name || 'Stüdyo'} için HWID sıfırlansın mı? Kilitli cihaz bağlantısı kaldırılır.`,
            confirmText: 'Sıfırla',
            danger: false,
            onConfirm: async () => {
                try {
                    await creatorApi.resetHwid(studio.organizationId, studio.id);
                    toast.success('HWID sıfırlandı!');
                    loadData();
                    setShowHwidModal(null);
                } catch (error) {
                    toast.error('HWID sıfırlama hatası: ' + error.message);
                } finally {
                    setConfirmState(null);
                }
            }
        });
    }

    function handleRegenerateLicense(studio) {
        setConfirmState({
            kind: 'regenLicense',
            title: 'Lisans Anahtarını Yenile',
            message: `${studio.info?.name || 'Stüdyo'} için yeni bir lisans anahtarı oluşturulacak. Mevcut anahtar geçersiz olacaktır.`,
            confirmText: 'Yenile',
            danger: false,
            onConfirm: async () => {
                try {
                    const result = await creatorApi.regenerateLicenseKey(studio.organizationId, studio.id);
                    toast.success(`Yeni lisans: ${result?.newLicenseKey || 'Oluşturuldu'}`);
                    loadData();
                    setShowHwidModal(null);
                } catch (error) {
                    toast.error('Lisans yenileme hatası: ' + error.message);
                } finally {
                    setConfirmState(null);
                }
            }
        });
    }

    const openDeviceModal = useCallback(async (studio) => {
        if (deviceModalPending) return;
        setDeviceModalPending(true);
        setShowHwidModal(studio);
        setDeviceLoading(true);
        setDeviceList([]);
        try {
            const result = await creatorApi.getStudioDevices(studio.organizationId, studio.id);
            setDeviceList(result?.devices || []);
        } catch (error) {
            console.error('Load devices error:', error);
            toast.error('Cihaz listesi yüklenemedi');
        } finally {
            setDeviceLoading(false);
            setDeviceModalPending(false);
        }
    }, [deviceModalPending]);

    function handleDeleteStudio(studio) {
        setConfirmState({
            kind: 'deleteStudio',
            title: 'Stüdyoyu Sil',
            message: `${studio.info?.name || 'Stüdyo'} ve tüm verileri kalıcı olarak silinecektir. Devam etmek için stüdyo adını yazın.`,
            confirmText: 'Sil',
            danger: true,
            requireText: studio.info?.name || 'SİL',
            onConfirm: async () => {
                try {
                    await creatorApi.deleteStudio(studio.organizationId, studio.id);
                    toast.success('Stüdyo silindi!');
                    loadData();
                } catch (error) {
                    toast.error('Silme hatası: ' + error.message);
                } finally {
                    setConfirmState(null);
                }
            }
        });
    }

    async function handleResetData() {
        if (resetConfirmText !== 'ONAYLIYORUM') return;
        if (!resetTotpCode || resetTotpCode.length !== 6) {
            toast.error('6 haneli TOTP kodu gerekli');
            return;
        }
        setResettingData(true);
        try {
            await creatorApi.resetStudioDataSecure(showResetModal.organizationId, showResetModal.id, resetOption, resetTotpCode);
            toast.success('Stüdyo verileri başarıyla sıfırlandı!');
            setShowResetModal(null);
            setResetTotpCode('');
            loadData();
        } catch (error) {
            toast.error('Sıfırlama hatası: ' + (error.message || 'Bilinmeyen hata'));
        } finally {
            setResettingData(false);
        }
    }

    // Build Mutation
    const buildMutation = useMutation({
        mutationFn: (data) => creatorApi.triggerBuild(data.id, data.name),
        onSuccess: () => {
            toast.success('Build başlatıldı!');
            setTimeout(() => { queryClient.invalidateQueries(['studios']); }, 5000);
        },
        onError: (error) => toast.error('Build Hatası: ' + error.message)
    });

    // Filtering
    const filteredStudios = studios.filter(studio => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = (
            studio.info?.name?.toLowerCase().includes(searchLower) ||
            studio.info?.owner?.toLowerCase().includes(searchLower) ||
            studio.id.toLowerCase().includes(searchLower)
        );
        return matchesSearch;
    });

    // Group studios by organization
    const groupedByOrg = {};
    filteredStudios.forEach(studio => {
        const orgId = studio.organizationId || '_legacy';
        if (!groupedByOrg[orgId]) groupedByOrg[orgId] = [];
        groupedByOrg[orgId].push(studio);
    });

    // Build org info map
    const orgMap = {};
    organizations.forEach(org => { orgMap[org.id] = org; });

    // Sort organizations: known orgs first (alphabetically), legacy last
    const sortedOrgIds = Object.keys(groupedByOrg).sort((a, b) => {
        if (a === '_legacy') return 1;
        if (b === '_legacy') return -1;
        const nameA = orgMap[a]?.name || a;
        const nameB = orgMap[b]?.name || b;
        return nameA.localeCompare(nameB, 'tr');
    });

    function toggleOrg(orgId) {
        setCollapsedOrgs(prev => ({ ...prev, [orgId]: !prev[orgId] }));
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Stüdyolar</h1>
                <button className="btn btn-primary" onClick={openCreateModal}>
                    <Plus size={18} /> Yeni Stüdyo
                </button>
            </div>

            {/* Search */}
            <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1', maxWidth: '400px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input type="text" className="form-input" placeholder="Stüdyo ara..."
                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '44px' }}
                    />
                </div>
            </div>

            {/* Studios Grouped by Organization */}
            {loading ? (
                <div className="loader"><div className="loader-spinner"></div></div>
            ) : sortedOrgIds.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                    <p style={{ color: 'var(--text-muted)' }}>
                        {searchTerm ? 'Arama sonucu bulunamadı.' : 'Henüz stüdyo eklenmemiş.'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {sortedOrgIds.map(orgId => {
                        const org = orgMap[orgId];
                        const orgStudios = groupedByOrg[orgId];
                        const isCollapsed = collapsedOrgs[orgId];
                        const orgName = org?.name || (orgId === '_legacy' ? 'Eski Stüdyolar (Legacy)' : orgId);
                        const orgOwner = org?.owner || '';

                        return (
                            <div key={orgId} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                {/* Organization Header */}
                                <div
                                    onClick={() => toggleOrg(orgId)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '16px 20px', cursor: 'pointer', userSelect: 'none',
                                        background: 'var(--bg-secondary)',
                                        borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color)',
                                        transition: 'background 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, var(--bg-secondary))'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {isCollapsed
                                            ? <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                                            : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />
                                        }
                                        <Building size={20} style={{ color: 'var(--primary)' }} />
                                        <div>
                                            <span style={{ fontWeight: 600, fontSize: '15px' }}>{orgName}</span>
                                            {orgOwner && (
                                                <span style={{ marginLeft: '10px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                                    — {orgOwner}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span style={{
                                        background: 'var(--primary)', color: '#fff', borderRadius: '12px',
                                        padding: '2px 10px', fontSize: '12px', fontWeight: 600
                                    }}>
                                        {orgStudios.length} şube
                                    </span>
                                </div>

                                {/* Studio List Under Organization */}
                                {!isCollapsed && (
                                    <div style={{ padding: '4px 0' }}>
                                        {orgStudios.map(studio => (
                                            <div key={studio.id} style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '12px 20px', borderBottom: '1px solid var(--border-color)',
                                                transition: 'background 0.1s'
                                            }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, rgba(0,0,0,0.02))'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ fontSize: '22px' }}>📷</span>
                                                    <div>
                                                        <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                            {studio.info?.name || 'İsimsiz'}
                                                            <PlanBadge tier={studio.plan?.tier || 'basic'} />
                                                            {onlineMap[studio.id] > 0 && (
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#22c55e', fontWeight: 600 }}>
                                                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                                                                    {onlineMap[studio.id]} online
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                            {studio.info?.owner || 'Sahip yok'} · HWID: {studio.license?.hwid_lock ? '🔒 Kayıtlı' : '⏳ Bekliyor'}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                                                            {studio.subscription && <SubscriptionBadge subscription={studio.subscription} />}
                                                            {studio.suspension?.active && <SuspensionBadge suspension={studio.suspension} />}
                                                        </div>
                                                        {studio.activity?.last_login_at && (
                                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                                Son giriş: {formatLastLogin(studio.activity.last_login_at)}
                                                                {studio.activity.last_app_version && ` · v${studio.activity.last_app_version}`}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span className={`studio-status ${studio.info?.subscription_status || 'inactive'}`} style={{ fontSize: '12px' }}>
                                                        {studio.info?.subscription_status === 'active' ? '✅ Aktif' :
                                                            studio.info?.subscription_status === 'suspended' ? '⏸️ Askıda' : '❌ Pasif'}
                                                    </span>

                                                    <div className="studio-actions">
                                                        <button className="btn btn-secondary btn-sm" title="Düzenle" onClick={() => openEditModal(studio)}>
                                                            <Edit size={14} />
                                                        </button>
                                                        <button className="btn btn-sm" title="Plan Değiştir" onClick={() => setShowPlanModal(studio)}
                                                            style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', fontSize: '11px', padding: '4px 8px' }}>
                                                            Plan
                                                        </button>
                                                        <button className="btn btn-sm" title="Aboneliği Güncelle" onClick={() => setShowSubscriptionModal(studio)}
                                                            style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                                                            <Clock size={14} />
                                                        </button>
                                                        <button className="btn btn-sm" title="Kupon Uygula" onClick={() => setShowCouponModal(studio)}
                                                            style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                                                            <Key size={14} />
                                                        </button>
                                                        <button className="btn btn-sm" title="AI Bot Ayarları" onClick={() => setShowBotModal(studio)}
                                                            style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }}>
                                                            🤖
                                                        </button>
                                                        <button className="btn btn-secondary btn-sm" title="Cihazlar" disabled={deviceModalPending} onClick={() => openDeviceModal(studio)}>
                                                            <Monitor size={14} />
                                                        </button>
                                                        <button className="btn btn-secondary btn-sm" title="Durum Değiştir"
                                                            onClick={() => {
                                                                if (studio.info?.subscription_status === 'active') {
                                                                    setShowSuspendModal(studio);
                                                                } else {
                                                                    handleToggleStatus(studio);
                                                                }
                                                            }}>
                                                            {studio.info?.subscription_status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                                                        </button>
                                                        <button className="btn btn-sm" title="Veri Sıfırlama (2FA)" onClick={() => { setShowResetModal(studio); setResetOption('archives'); setResetConfirmText(''); setResetTotpCode(''); }}
                                                            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                                                            <Database size={14} />
                                                        </button>
                                                        <button className="btn btn-sm" title="Klonla" onClick={() => setShowCloneModal(studio)}
                                                            style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
                                                            <Copy size={14} />
                                                        </button>
                                                        <button className="btn btn-sm" title="Org Degistir" onClick={() => setShowMoveModal(studio)}
                                                            style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
                                                            <ArrowRightLeft size={14} />
                                                        </button>
                                                        <button className="btn btn-sm" title="Veri Export" onClick={() => setShowExportModal(studio)}
                                                            style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                                                            <Globe size={14} />
                                                        </button>
                                                        <button className="btn btn-sm" title="Yedekler & Depolama" onClick={() => setShowBackupPanel(studio)}
                                                            style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}>
                                                            <Database size={14} />
                                                        </button>
                                                        <button className="btn btn-sm" title="Update Kanalı" onClick={() => { setShowUpdateChannelModal(studio); setUpdateChannelValue(studio.update?.channel || 'stable'); setUpdateMinVersion(studio.update?.minVersion || ''); }}
                                                            style={{ background: 'rgba(99,102,241,0.1)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.3)', fontSize: '11px', padding: '4px 8px' }}>
                                                            Kanal
                                                        </button>
                                                        <button className="btn btn-sm" title="Logları Al" onClick={() => { setShowRemoteLogModal(studio); setRemoteLogRequestId(null); setRemoteLogStatus(null); }}
                                                            style={{ background: 'rgba(52,211,153,0.1)', color: '#6ee7b7', border: '1px solid rgba(52,211,153,0.3)', fontSize: '11px', padding: '4px 8px' }}>
                                                            Log
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
                            </div>
                        );
                    })}
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
                            <button className={`tab ${activeTab === 'general' ? 'active' : ''}`}
                                onClick={() => setActiveTab('general')}>
                                <Settings size={16} /> Genel
                            </button>
                            {editingStudio && (
                                <button className={`tab ${activeTab === 'integrations' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('integrations')}>
                                    <Globe size={16} /> Entegrasyonlar
                                </button>
                            )}
                            {editingStudio && (
                                <button className={`tab ${activeTab === 'whatsapp' ? 'active' : ''}`}
                                    onClick={async () => {
                                        setActiveTab('whatsapp');
                                        if (!waStatus) {
                                            setWaLoading(true);
                                            try {
                                                const res = await creatorApi.getWhatsappStatus(editingStudio.organizationId, editingStudio.id);
                                                setWaStatus(res.status);
                                            } catch { setWaStatus(null); }
                                            setWaLoading(false);
                                        }
                                    }}>
                                    <Wifi size={16} /> WhatsApp
                                </button>
                            )}
                        </div>

                        <form onSubmit={!editingStudio && wizardStep === 1 ? handleNextStep : handleSaveStudio}>
                            <div className="modal-body">
                                {activeTab === 'general' && (
                                    <>
                                        {/* Wizard Step 1: Select or Create Org (New Studio Only) */}
                                        {!editingStudio && wizardStep === 1 && (
                                            <div className="wizard-step">
                                                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                                    <button type="button"
                                                        className={`btn btn-sm ${orgMode === 'select' ? 'btn-primary' : 'btn-secondary'}`}
                                                        onClick={() => setOrgMode('select')} style={{ flex: 1 }}>
                                                        Mevcut Firmayı Seç
                                                    </button>
                                                    <button type="button"
                                                        className={`btn btn-sm ${orgMode === 'create' ? 'btn-primary' : 'btn-secondary'}`}
                                                        onClick={() => setOrgMode('create')} style={{ flex: 1 }}>
                                                        Yeni Firma Oluştur
                                                    </button>
                                                </div>

                                                {orgMode === 'select' ? (
                                                    <div className="form-group">
                                                        <label className="form-label">Organizasyon (Firma) *</label>
                                                        <select className="form-input" required
                                                            value={formData.organizationId}
                                                            onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}>
                                                            <option value="">Seçiniz...</option>
                                                            {organizations.map(org => (
                                                                <option key={org.id} value={org.id}>{org.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ) : (
                                                    <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                        <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-primary)' }}>Firma Bilgileri</h4>
                                                        <div className="form-group">
                                                            <label className="form-label">Firma Adı *</label>
                                                            <input type="text" className="form-input" required
                                                                value={newOrgData.name}
                                                                onChange={e => setNewOrgData(p => ({ ...p, name: e.target.value }))}
                                                                placeholder="Örn: Zümrüt Fotoğrafçılık"
                                                            />
                                                        </div>
                                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                                            <label className="form-label">Sahip / Yetkili</label>
                                                            <input type="text" className="form-input"
                                                                value={newOrgData.owner}
                                                                onChange={e => setNewOrgData(p => ({ ...p, owner: e.target.value }))}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Wizard Step 2 OR Editing: Studio Form */}
                                        {((!editingStudio && wizardStep === 2) || editingStudio) && (
                                            <div className="wizard-step">
                                                {!editingStudio && (
                                                    <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <span><strong>Firma:</strong> {organizations.find(o => o.id === formData.organizationId)?.name || newOrgData.name}</span>
                                                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => setWizardStep(1)} style={{ padding: '4px 8px', fontSize: '12px', background: 'transparent', border: 'none', color: 'var(--primary)', textDecoration: 'underline' }}>
                                                            Değiştir
                                                        </button>
                                                    </div>
                                                )}

                                                <div className="form-group">
                                                    <label className="form-label">Stüdyo Adı *</label>
                                                    <input type="text" className="form-input" required
                                                        value={formData.name}
                                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Şube / Stüdyo Yetkilisi</label>
                                                    <input type="text" className="form-input"
                                                        value={formData.owner}
                                                        onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Stüdyo E-posta</label>
                                                    <input type="email" className="form-input"
                                                        value={formData.email}
                                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Yönetici E-posta</label>
                                                    <input type="email" className="form-input"
                                                        value={formData.ownerEmail}
                                                        onChange={e => setFormData({ ...formData, ownerEmail: e.target.value })}
                                                        placeholder="ahmet@example.com"
                                                    />
                                                </div>

                                                {!editingStudio && (
                                                    <>
                                                        <div className="form-group">
                                                            <label className="form-label">Yönetici Şifresi *</label>
                                                            <div style={{ position: 'relative' }}>
                                                                <input type={showPasswords.admin ? 'text' : 'password'}
                                                                    required minLength={8} className="form-input"
                                                                    style={{ paddingRight: '40px' }}
                                                                    value={formData.adminPassword || ''}
                                                                    onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                                                                    placeholder="Min. 8 karakter"
                                                                />
                                                                <button type="button" onClick={() => setShowPasswords(p => ({ ...p, admin: !p.admin }))}
                                                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                                                                    {showPasswords.admin ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="form-group">
                                                            <label className="form-label">Personel Şifresi *</label>
                                                            <div style={{ position: 'relative' }}>
                                                                <input type={showPasswords.user ? 'text' : 'password'}
                                                                    required minLength={8} className="form-input"
                                                                    style={{ paddingRight: '40px' }}
                                                                    value={formData.userPassword || ''}
                                                                    onChange={e => setFormData({ ...formData, userPassword: e.target.value })}
                                                                    placeholder="Min. 8 karakter"
                                                                />
                                                                <button type="button" onClick={() => setShowPasswords(p => ({ ...p, user: !p.user }))}
                                                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                                                                    {showPasswords.user ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                <div className="form-group">
                                                    <label className="form-label">Telefon</label>
                                                    <input type="tel" className="form-input"
                                                        value={formData.contact}
                                                        onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                                                    />
                                                </div>
                                                {!editingStudio && (
                                                    <div className="form-group">
                                                        <label className="form-label">
                                                            Deneme Süresi (gün)
                                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                                                (Boş bırakılırsa deneme başlatılmaz)
                                                            </span>
                                                        </label>
                                                        <input type="number" min="1" max="365" className="form-input"
                                                            placeholder="Örn: 14"
                                                            value={formData.trialDays || ''}
                                                            onChange={e => setFormData({ ...formData, trialDays: e.target.value })}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* INTEGRATIONS TAB */}
                                {activeTab === 'integrations' && editingStudio && (
                                    <div style={{ padding: '8px 0' }}>
                                        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Globe size={18} /> WooCommerce Ayarları
                                        </h3>
                                        <div className="form-group">
                                            <label className="form-label">WooCommerce URL</label>
                                            <input type="url" className="form-input"
                                                value={formData.wc_url}
                                                onChange={(e) => setFormData({ ...formData, wc_url: e.target.value })}
                                                placeholder="https://example.com"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Consumer Key</label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <div style={{ position: 'relative', flex: 1 }}>
                                                    <input type={wcSecretState.keyVisible ? 'text' : 'password'} className="form-input"
                                                        value={formData.wc_consumer_key}
                                                        disabled={wcSecretState.hasStoredKey && !wcSecretState.keyChanged}
                                                        onChange={(e) => setFormData({ ...formData, wc_consumer_key: e.target.value })}
                                                        placeholder="ck_..." style={{ fontFamily: 'monospace', fontSize: '13px', paddingRight: '40px' }}
                                                    />
                                                    {(!wcSecretState.hasStoredKey || wcSecretState.keyChanged) && (
                                                        <button type="button"
                                                            onClick={() => setWcSecretState(s => ({ ...s, keyVisible: !s.keyVisible }))}
                                                            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                                                            {wcSecretState.keyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                                        </button>
                                                    )}
                                                </div>
                                                {wcSecretState.hasStoredKey && !wcSecretState.keyChanged && (
                                                    <button type="button" className="btn btn-secondary btn-sm"
                                                        onClick={() => {
                                                            setFormData(p => ({ ...p, wc_consumer_key: '' }));
                                                            setWcSecretState(s => ({ ...s, keyChanged: true }));
                                                        }}>
                                                        Değiştir
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Consumer Secret</label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <div style={{ position: 'relative', flex: 1 }}>
                                                    <input type={wcSecretState.secretVisible ? 'text' : 'password'} className="form-input"
                                                        value={formData.wc_consumer_secret}
                                                        disabled={wcSecretState.hasStoredSecret && !wcSecretState.secretChanged}
                                                        onChange={(e) => setFormData({ ...formData, wc_consumer_secret: e.target.value })}
                                                        placeholder="cs_..." style={{ fontFamily: 'monospace', fontSize: '13px', paddingRight: '40px' }}
                                                    />
                                                    {(!wcSecretState.hasStoredSecret || wcSecretState.secretChanged) && (
                                                        <button type="button"
                                                            onClick={() => setWcSecretState(s => ({ ...s, secretVisible: !s.secretVisible }))}
                                                            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                                                            {wcSecretState.secretVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                                        </button>
                                                    )}
                                                </div>
                                                {wcSecretState.hasStoredSecret && !wcSecretState.secretChanged && (
                                                    <button type="button" className="btn btn-secondary btn-sm"
                                                        onClick={() => {
                                                            setFormData(p => ({ ...p, wc_consumer_secret: '' }));
                                                            setWcSecretState(s => ({ ...s, secretChanged: true }));
                                                        }}>
                                                        Değiştir
                                                    </button>
                                                )}
                                            </div>
                                        </div>
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
                                                        <label className="form-label">Telefon</label>
                                                        <input type="text" className="form-input" value={waStatus.phone} disabled />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                                <WifiOff size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                                                <p>WhatsApp durumu bulunamadı.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Kapat</button>
                                {activeTab !== 'whatsapp' && (
                                    <button type="submit" className="btn btn-primary" disabled={creatingOrg}>
                                        {creatingOrg ? (
                                            <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Oluşturuluyor...</>
                                        ) : !editingStudio && wizardStep === 1 ? (
                                            orgMode === 'create' ? <><Plus size={16} /> Firma Oluştur & Devam Et</> : 'Devam Et →'
                                        ) : (
                                            <><Save size={16} /> Kaydet</>
                                        )}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Device Management Modal */}
            {showHwidModal && (
                <div className="modal-overlay" onClick={() => setShowHwidModal(null)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: '820px' }}>
                        <div className="modal-header">
                            <h2><Monitor size={20} /> Cihaz & Lisans Yönetimi</h2>
                            <button className="modal-close" onClick={() => setShowHwidModal(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body" style={{ padding: '16px 20px' }}>
                            {/* Studio + License Info */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontSize: '11px' }}>Stüdyo</label>
                                    <input type="text" className="form-input" value={showHwidModal.info?.name || ''} disabled style={{ fontSize: '13px' }} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontSize: '11px' }}>Organizasyon</label>
                                    <input type="text" className="form-input" value={orgMap[showHwidModal.organizationId]?.name || showHwidModal.organizationId} disabled style={{ fontSize: '13px' }} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontSize: '11px' }}>Lisans Anahtarı</label>
                                    <input type="text" className="form-input" value={showHwidModal.license?.license_key || 'Yok'} disabled style={{ fontFamily: 'monospace', fontSize: '13px' }} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontSize: '11px' }}>Eski HWID (Legacy)</label>
                                    <input type="text" className="form-input" value={showHwidModal.license?.hwid_lock || '—'} disabled style={{ fontFamily: 'monospace', fontSize: '13px' }} />
                                </div>
                            </div>

                            {/* Devices Section */}
                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Monitor size={16} /> Bağlı Cihazlar
                                        {deviceList.filter(d => d.status === 'pending').length > 0 && (
                                            <span style={{
                                                background: '#f59e0b', color: '#fff', borderRadius: '10px',
                                                padding: '1px 8px', fontSize: '11px', fontWeight: 600, animation: 'pulse 2s infinite'
                                            }}>
                                                {deviceList.filter(d => d.status === 'pending').length} bekliyor
                                            </span>
                                        )}
                                    </h3>
                                    <button className="btn btn-secondary btn-sm" onClick={() => openDeviceModal(showHwidModal)} disabled={deviceLoading}>
                                        <RefreshCcw size={12} /> Yenile
                                    </button>
                                </div>

                                {deviceLoading ? (
                                    <div style={{ textAlign: 'center', padding: '24px' }}>
                                        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                                    </div>
                                ) : deviceList.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                        Henüz cihaz bağlanmamış.
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                                    <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600 }}>Cihaz</th>
                                                    <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600 }}>HWID</th>
                                                    <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600 }}>MAC</th>
                                                    <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600 }}>IP</th>
                                                    <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600 }}>Son Aktiflik</th>
                                                    <th style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 600 }}>Durum</th>
                                                    <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>İşlem</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {deviceList.map(device => (
                                                    <tr key={device.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: '8px 6px' }}>
                                                            <div style={{ fontWeight: 500 }}>{device.hostname || '—'}</div>
                                                            {device.deviceInfo?.platform && (
                                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                                                    {device.deviceInfo.platform} ({device.deviceInfo.arch})
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontSize: '10px' }}>
                                                            {device.hwid ? device.hwid.substring(0, 12) + '...' : '—'}
                                                        </td>
                                                        <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontSize: '11px' }}>
                                                            {device.macAddress || '—'}
                                                        </td>
                                                        <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontSize: '11px' }}>
                                                            {device.ipAddress || '—'}
                                                        </td>
                                                        <td style={{ padding: '8px 6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                                            {device.lastActiveAt ? new Date(device.lastActiveAt).toLocaleString('tr-TR') : '—'}
                                                        </td>
                                                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                                                            {device.status === 'approved' && (
                                                                <span style={{ color: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px' }}>
                                                                    <CheckCircle size={12} /> Onaylı
                                                                </span>
                                                            )}
                                                            {device.status === 'pending' && (
                                                                <span style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600 }}>
                                                                    <Clock size={12} /> Bekliyor
                                                                </span>
                                                            )}
                                                            {device.status === 'rejected' && (
                                                                <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px' }}>
                                                                    <XCircle size={12} /> Reddedildi
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                                {device.status === 'pending' && (
                                                                    <>
                                                                        <button
                                                                            className="btn btn-primary btn-sm"
                                                                            style={{ fontSize: '11px', padding: '4px 8px' }}
                                                                            disabled={deviceModalPending}
                                                                            onClick={async () => {
                                                                                if (deviceModalPending) return;
                                                                                try {
                                                                                    await creatorApi.approveDevice(showHwidModal.organizationId, showHwidModal.id, device.id);
                                                                                    toast.success('Cihaz onaylandı!');
                                                                                    openDeviceModal(showHwidModal);
                                                                                } catch (err) {
                                                                                    toast.error('Onaylama hatası: ' + err.message);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <CheckCircle size={12} /> Onayla
                                                                        </button>
                                                                        <button
                                                                            className="btn btn-danger btn-sm"
                                                                            style={{ fontSize: '11px', padding: '4px 8px' }}
                                                                            disabled={deviceModalPending}
                                                                            onClick={async () => {
                                                                                if (deviceModalPending) return;
                                                                                try {
                                                                                    await creatorApi.rejectDevice(showHwidModal.organizationId, showHwidModal.id, device.id);
                                                                                    toast.success('Cihaz reddedildi');
                                                                                    openDeviceModal(showHwidModal);
                                                                                } catch (err) {
                                                                                    toast.error('Reddetme hatası: ' + err.message);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <XCircle size={12} /> Reddet
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {device.status === 'approved' && (
                                                                    <button
                                                                        className="btn btn-secondary btn-sm"
                                                                        style={{ fontSize: '11px', padding: '4px 8px' }}
                                                                        onClick={() => setConfirmState({
                                                                            kind: 'removeDevice',
                                                                            title: 'Cihaz Erişimini Kaldır',
                                                                            message: 'Bu cihazın erişimi kaldırılacak. Devam edilsin mi?',
                                                                            confirmText: 'Kaldır',
                                                                            danger: true,
                                                                            onConfirm: async () => {
                                                                                try {
                                                                                    await creatorApi.rejectDevice(showHwidModal.organizationId, showHwidModal.id, device.id);
                                                                                    toast.success('Cihaz erişimi kaldırıldı');
                                                                                    openDeviceModal(showHwidModal);
                                                                                } catch (err) {
                                                                                    toast.error('Kaldırma hatası: ' + err.message);
                                                                                } finally {
                                                                                    setConfirmState(null);
                                                                                }
                                                                            }
                                                                        })}
                                                                    >
                                                                        <Trash2 size={12} /> Kaldır
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-secondary" onClick={() => handleResetHwid(showHwidModal)}>
                                    <RotateCcw size={14} /> HWID Sıfırla
                                </button>
                                <button className="btn btn-secondary" onClick={() => handleRegenerateLicense(showHwidModal)}>
                                    <RefreshCcw size={14} /> Lisans Yenile
                                </button>
                            </div>
                            <button className="btn btn-secondary" onClick={() => setShowHwidModal(null)}>Kapat</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Data Modal */}
            {showResetModal && (
                <div className="modal-overlay" onClick={() => !resettingData && setShowResetModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>Veri Sıfırlama</h2>
                            <button className="modal-close" onClick={() => !resettingData && setShowResetModal(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                                Lütfen <strong>{showResetModal.info?.name}</strong> için sıfırlamak istediğiniz veri türünü seçin:
                            </p>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '12px', background: resetOption === 'archives' ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)', border: `1px solid ${resetOption === 'archives' ? 'var(--primary)' : 'var(--border-color)'}`, borderRadius: '8px' }}>
                                    <input type="radio" name="resetOption" value="archives" checked={resetOption === 'archives'} onChange={() => setResetOption('archives')} style={{ marginTop: '4px' }} />
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Arşiv Database</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sadece arşiv listesi ve müşteri listesi silinir. (Okullar, paketler vb. kalır)</div>
                                    </div>
                                </label>
                                
                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '12px', background: resetOption === 'all' ? 'rgba(239,68,68,0.1)' : 'var(--bg-secondary)', border: `1px solid ${resetOption === 'all' ? '#ef4444' : 'var(--border-color)'}`, borderRadius: '8px' }}>
                                    <input type="radio" name="resetOption" value="all" checked={resetOption === 'all'} onChange={() => setResetOption('all')} style={{ marginTop: '4px' }} />
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#ef4444' }}>Tüm Veriler</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Arşivler, müşteriler, okullar, paketler, hediyeler vb. kullanıcı tarafından oluşturulan tüm veriler silinir. (Stüdyo ayarları kalır)</div>
                                    </div>
                                </label>
                            </div>

                            <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                                <strong>Dikkat:</strong> {showResetModal.info?.name} stüdyosunun seçilen verileri kalıcı olarak silinecektir.
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Onaylıyorsanız aşağıya "ONAYLIYORUM" yazın:</label>
                                <input type="text" className="form-input"
                                    value={resetConfirmText}
                                    onChange={e => setResetConfirmText(e.target.value)}
                                    placeholder="ONAYLIYORUM"
                                />
                            </div>
                            <div className="form-group" style={{ marginTop: 14 }}>
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Shield size={13} /> 2FA Kodu (TOTP) *
                                </label>
                                <input type="text" className="form-input"
                                    value={resetTotpCode}
                                    onChange={e => setResetTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="6 haneli kod"
                                    maxLength={6}
                                    style={{ letterSpacing: 4, fontFamily: 'monospace', width: 140 }}
                                />
                                <p style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>Authenticator uygulamanızdaki kodu girin. 2FA aktif değilse işlem reddedilir.</p>
                            </div>
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => { setShowResetModal(null); setResetTotpCode(''); }} disabled={resettingData}>
                                Vazgeç
                            </button>
                            <button className="btn btn-danger"
                                disabled={resetConfirmText !== 'ONAYLIYORUM' || resetTotpCode.length !== 6 || resettingData}
                                onClick={handleResetData}
                            >
                                {resettingData ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Siliniyor...</> : 'Sil'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bot Config Modal */}
            {showBotModal && (
                <BotConfigModal
                    studio={showBotModal}
                    onClose={() => setShowBotModal(null)}
                    onRefresh={loadData}
                />
            )}

            <ConfirmDialog
                open={!!confirmState}
                onClose={() => setConfirmState(null)}
                onConfirm={confirmState?.onConfirm}
                title={confirmState?.title}
                message={confirmState?.message}
                confirmText={confirmState?.confirmText}
                cancelText={confirmState?.cancelText || 'Vazgeç'}
                danger={confirmState?.danger}
                requireText={confirmState?.requireText}
            />

            {/* Faz 3 Modals */}
            {showCloneModal && (
                <CloneStudioModal
                    studio={showCloneModal}
                    organizations={organizations}
                    onClose={() => setShowCloneModal(null)}
                    onSuccess={loadData}
                />
            )}
            {showMoveModal && (
                <MoveStudioModal
                    studio={showMoveModal}
                    organizations={organizations}
                    onClose={() => setShowMoveModal(null)}
                    onSuccess={loadData}
                />
            )}
            {showExportModal && (
                <ExportModal
                    studio={showExportModal}
                    onClose={() => setShowExportModal(null)}
                />
            )}
            {showBackupPanel && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#1a1a2e', border: '1px solid #334155', borderRadius: 14, padding: 24, width: 560, maxWidth: '95vw', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>{showBackupPanel.info?.name} — Yedekler & Depolama</span>
                            <button onClick={() => setShowBackupPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <BackupPanel studio={showBackupPanel} />
                    </div>
                </div>
            )}

            {/* Faz 2 Modals */}
            {showPlanModal && (
                <PlanChangeModal
                    studio={showPlanModal}
                    onClose={() => setShowPlanModal(null)}
                    onSuccess={loadData}
                />
            )}
            {showSuspendModal && (
                <SuspendModal
                    studio={showSuspendModal}
                    onClose={() => setShowSuspendModal(null)}
                    onSuccess={loadData}
                />
            )}
            {showSubscriptionModal && (
                <SubscriptionModal
                    studio={showSubscriptionModal}
                    onClose={() => setShowSubscriptionModal(null)}
                    onSuccess={loadData}
                />
            )}
            {showCouponModal && (
                <CouponApplyModal
                    studio={showCouponModal}
                    onClose={() => setShowCouponModal(null)}
                    onSuccess={loadData}
                />
            )}

            {/* H4: Update Channel Modal */}
            {showUpdateChannelModal && (
                <div className="modal-overlay" onClick={() => setShowUpdateChannelModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Update Kanalı — {showUpdateChannelModal.info?.name}</h2>
                            <button className="modal-close" onClick={() => setShowUpdateChannelModal(null)}><X size={20} /></button>
                        </div>
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px' }}>Kanal</label>
                                <select className="input" value={updateChannelValue} onChange={e => setUpdateChannelValue(e.target.value)}>
                                    <option value="stable">stable (Kararlı)</option>
                                    <option value="beta">beta</option>
                                    <option value="canary">canary (Erken Erişim)</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px' }}>Minimum Versiyon (opsiyonel)</label>
                                <input className="input" placeholder="örn: 1.2.0" value={updateMinVersion} onChange={e => setUpdateMinVersion(e.target.value)} />
                            </div>
                            <button className="btn btn-primary" disabled={savingChannel} onClick={async () => {
                                setSavingChannel(true);
                                try {
                                    const fn = httpsCallable(functions, 'setup-setStudioUpdateChannel');
                                    await fn({ studioId: showUpdateChannelModal.id, organizationId: showUpdateChannelModal.organizationId, channel: updateChannelValue, minVersion: updateMinVersion || undefined });
                                    toast.success('Update kanalı güncellendi');
                                    setShowUpdateChannelModal(null);
                                    loadData();
                                } catch (err) {
                                    toast.error(err.message || 'Hata');
                                } finally {
                                    setSavingChannel(false);
                                }
                            }}>
                                {savingChannel ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* H2: Remote Log Modal */}
            {showRemoteLogModal && (
                <div className="modal-overlay" onClick={() => setShowRemoteLogModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Logları Al — {showRemoteLogModal.info?.name}</h2>
                            <button className="modal-close" onClick={() => setShowRemoteLogModal(null)}><X size={20} /></button>
                        </div>
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {!remoteLogRequestId ? (
                                <button className="btn btn-primary" disabled={remoteLogLoading} onClick={async () => {
                                    setRemoteLogLoading(true);
                                    try {
                                        const fn = httpsCallable(functions, 'setup-requestRemoteLogs');
                                        const res = await fn({ studioId: showRemoteLogModal.id });
                                        setRemoteLogRequestId(res.data.requestId);
                                        toast.success('Log isteği oluşturuldu. Client yükleyince indirme linki belirecek.');
                                    } catch (err) {
                                        toast.error(err.message || 'Hata');
                                    } finally {
                                        setRemoteLogLoading(false);
                                    }
                                }}>
                                    {remoteLogLoading ? 'İstek Oluşturuluyor...' : 'Log İste'}
                                </button>
                            ) : (
                                <div>
                                    <p style={{ fontSize: '13px', marginBottom: '12px', color: 'var(--text-muted)' }}>
                                        Request ID: <code>{remoteLogRequestId}</code><br />
                                        Client uygulama bu isteği algıladığında logları yükleyecek.
                                    </p>
                                    <button className="btn btn-secondary" disabled={remoteLogLoading} onClick={async () => {
                                        setRemoteLogLoading(true);
                                        try {
                                            const fn = httpsCallable(functions, 'setup-getRemoteLogStatus');
                                            const res = await fn({ requestId: remoteLogRequestId });
                                            setRemoteLogStatus(res.data);
                                        } catch (err) {
                                            toast.error(err.message || 'Hata');
                                        } finally {
                                            setRemoteLogLoading(false);
                                        }
                                    }}>
                                        Durumu Kontrol Et
                                    </button>
                                    {remoteLogStatus && (
                                        <div style={{ marginTop: '12px', fontSize: '13px' }}>
                                            <b>Durum:</b> {remoteLogStatus.status}<br />
                                            {remoteLogStatus.downloadUrl && (
                                                <a href={remoteLogStatus.downloadUrl} target="_blank" rel="noreferrer"
                                                    className="btn btn-primary" style={{ display: 'inline-flex', marginTop: '8px', textDecoration: 'none' }}>
                                                    Log Dosyasını İndir
                                                </a>
                                            )}
                                            {remoteLogStatus.status === 'pending' && (
                                                <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Client henüz yüklemedi. 1-2 dakika bekleyin.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

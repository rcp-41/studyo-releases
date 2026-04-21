import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { settingsApi, whatsappApi, optionsApi, schoolsApi } from '../services/api';
import { cn, formatDate } from '../lib/utils';
import {
    Settings2, MessageSquare, Mail, Shield,
    Save, Loader2, CheckCircle, AlertCircle, Eye, EyeOff, FolderOpen,
    QrCode, LogOut, Smartphone, Plus, Trash2, Clock, Monitor, Package, Database, Download, Upload,
    School, ChevronDown, ChevronUp, Printer
} from 'lucide-react';
import { toast } from 'sonner';
import { backupApi } from '../services/backup';
import auditLog from '../services/auditLog';
import PrintSettingsModal from '../components/PrintSettingsModal';
import { getPrintSettings } from '../lib/printSettings';

function SettingInput({ label, value, onChange, type = 'text', placeholder, description, isPassword }) {
    const [showPassword, setShowPassword] = useState(false);

    if (type === 'boolean') {
        return (
            <div className="flex items-center justify-between py-3">
                <div>
                    <label className="font-medium">{label}</label>
                    {description && <p className="text-sm text-muted-foreground">{description}</p>}
                </div>
                <button
                    type="button"
                    onClick={() => onChange(!value)}
                    className={cn('w-11 h-6 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 flex-shrink-0', value ? 'bg-primary' : 'bg-input/50')}
                >
                    <span className={cn('absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm', value ? 'translate-x-5' : 'translate-x-0')} />
                </button>
            </div>
        );
    }

    return (
        <div className="py-3">
            <label className="block font-medium mb-1">{label}</label>
            {description && <p className="text-sm text-muted-foreground mb-2">{description}</p>}
            <div className="relative">
                <input
                    type={isPassword && !showPassword ? 'password' : 'text'}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                />
                {isPassword && (
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                )}
            </div>
        </div>
    );
}

function WhatsAppCard({ enabled, onToggle }) {
    const [status, setStatus] = useState('DISCONNECTED');
    const [qr, setQr] = useState(null);
    const [loading, setLoading] = useState(false);
    const hasElectronWhatsApp = !!window.electron?.whatsapp;

    useEffect(() => {
        if (!enabled || !hasElectronWhatsApp) return;

        const whatsapp = window.electron.whatsapp;
        whatsapp.onStatus((s) => setStatus(s.toUpperCase()));
        whatsapp.onQr((qrData) => setQr(qrData));

        // Auto-init
        whatsappApi.init().catch(console.error);

        // Poll for reliability
        const interval = setInterval(async () => {
            try {
                const r = await whatsappApi.getStatus();
                const s = r?.status || 'disconnected';
                setStatus(s.toUpperCase());
                if (s === 'qr_ready') {
                    const qrR = await whatsappApi.getQr();
                    setQr(qrR?.qr || null);
                } else if (s === 'connected') setQr(null);
            } catch (_) { }
        }, 3000);

        return () => { clearInterval(interval); whatsapp.removeListeners?.(); };
    }, [enabled, hasElectronWhatsApp]);

    const handleLogout = async () => {
        setLoading(true);
        try { await whatsappApi.logout(); toast.success('Oturum kapatıldı'); setStatus('DISCONNECTED'); setQr(null); }
        catch (_) { toast.error('Çıkış yapılamadı'); }
        setLoading(false);
    };

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10"><MessageSquare className="w-5 h-5 text-green-600" /></div>
                    <div>
                        <h3 className="font-semibold">WhatsApp Web</h3>
                        <p className="text-sm text-muted-foreground">Kendi numaranızı bağlayın</p>
                    </div>
                </div>
                <button onClick={onToggle} className={cn('w-11 h-6 rounded-full relative transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 flex-shrink-0', enabled ? 'bg-green-600' : 'bg-input/50')}>
                    <span className={cn('absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm', enabled ? 'translate-x-5' : 'translate-x-0')} />
                </button>
            </div>

            {enabled && (
                <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border">
                    <div className="flex flex-col items-center justify-center text-center">
                        {!hasElectronWhatsApp ? (
                            <div className="flex flex-col items-center gap-3 py-4">
                                <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center">
                                    <MessageSquare className="w-8 h-8 text-yellow-600" />
                                </div>
                                <h4 className="font-medium text-yellow-600">Masaüstü Uygulaması Gerekli</h4>
                                <p className="text-sm text-muted-foreground">WhatsApp entegrasyonu sadece masaüstü uygulamasında kullanılabilir.</p>
                            </div>
                        ) : status === 'CONNECTED' ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                                    <CheckCircle className="w-8 h-8 text-green-600" />
                                </div>
                                <h4 className="font-medium text-green-600">Bağlantı Başarılı</h4>
                                <p className="text-sm text-muted-foreground">WhatsApp hesabınız bağlandı ve kullanıma hazır.</p>
                                <button onClick={handleLogout} disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm mt-2">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                                    Oturumu Kapat
                                </button>
                            </div>
                        ) : qr && status === 'QR_READY' ? (
                            <div className="flex flex-col items-center gap-4 py-2">
                                <div className="bg-white p-4 rounded-xl shadow-sm border">
                                    <img src={qr} alt="WhatsApp QR" className="w-56 h-56" />
                                </div>
                                <div className="space-y-2 max-w-sm">
                                    <h4 className="font-medium">Cihaz Bağla</h4>
                                    <ol className="text-sm text-muted-foreground text-left list-decimal pl-4 space-y-1">
                                        <li>Telefonunuzda WhatsApp'ı açın</li>
                                        <li>Ayarlar {'>'} Bağlı Cihazlar menüsüne gidin</li>
                                        <li>"Cihaz Bağla" diyerek QR kodu okutun</li>
                                    </ol>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3 py-4">
                                <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
                                <h4 className="font-medium">QR Kodu Yükleniyor...</h4>
                                <p className="text-sm text-muted-foreground">
                                    WhatsApp Web başlatılıyor, lütfen bekleyin.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}




// Preset colors for shoot types
const PRESET_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

// Generic Data List Component
function DataList({ title, items, onDelete, onAdd, withColor, onColorChange }) {
    const [newItem, setNewItem] = useState('');
    const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

    const handleAdd = () => {
        if (!newItem.trim()) return;
        if (withColor) {
            onAdd({ name: newItem, color: newColor });
        } else {
            onAdd(newItem);
        }
        setNewItem('');
        setNewColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    };

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4">{title}</h3>

            <div className="flex gap-2 mb-4">
                {withColor && (
                    <input
                        type="color"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-input cursor-pointer p-1"
                        title="Renk seç"
                    />
                )}
                <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="Yeni ekle..."
                    className="flex-1 px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
                <button
                    onClick={handleAdd}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {items?.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg group">
                        <div className="flex items-center gap-2">
                            {withColor && (
                                <input
                                    type="color"
                                    value={item.color || '#3b82f6'}
                                    onChange={(e) => onColorChange?.(item.id, e.target.value)}
                                    className="w-6 h-6 rounded border border-input cursor-pointer p-0.5"
                                    title="Renk değiştir"
                                />
                            )}
                            <span className="text-sm">{item.name}</span>
                        </div>
                        <button
                            onClick={() => onDelete(item.id)}
                            className="p-1.5 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 rounded"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                {items?.length === 0 && (
                    <div className="text-center py-4 text-sm text-muted-foreground">Liste boş</div>
                )}
            </div>
        </div>
    );
}

// Package List Component (name + price)
function PackageList({ items, onDelete, onAdd }) {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');

    const handleAdd = () => {
        if (!name.trim()) return;
        onAdd({ name: name.trim(), price: parseFloat(price) || 0 });
        setName('');
        setPrice('');
    };

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Package className="w-4 h-4" /> Paketler</h3>
            <div className="flex gap-2 mb-4">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Paket adı..." className="flex-1 px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                    placeholder="₺ Fiyat" className="w-24 px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
                <button onClick={handleAdd} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                    <Plus className="w-4 h-4" />
                </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {items?.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg group">
                        <span className="text-sm">{item.name}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-primary">₺{item.price || 0}</span>
                            <button onClick={() => onDelete(item.id)}
                                className="p-1.5 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 rounded">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
                {items?.length === 0 && <div className="text-center py-4 text-sm text-muted-foreground">Paket yok</div>}
            </div>
        </div>
    );
}

// School Manager Component
function SchoolManager({ schools, onCreate, onDelete }) {
    const [newName, setNewName] = useState('');
    const [newClasses, setNewClasses] = useState('');
    const [expandedId, setExpandedId] = useState(null);

    const handleAdd = () => {
        if (!newName.trim()) return;
        const classArr = newClasses.split(',').map(c => c.trim()).filter(Boolean);
        onCreate({ name: newName.trim(), classes: classArr });
        setNewName('');
        setNewClasses('');
    };

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><School className="w-4 h-4" /> Okul Yönetimi</h3>
            <div className="space-y-2 mb-4">
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Okul adı..." className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                    onKeyDown={e => e.key === 'Enter' && handleAdd()} />
                <div className="flex gap-2">
                    <input type="text" value={newClasses} onChange={e => setNewClasses(e.target.value)}
                        placeholder="Sınıflar (virgülle): 1-A, 1-B, 2-A..."
                        className="flex-1 px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                        onKeyDown={e => e.key === 'Enter' && handleAdd()} />
                    <button onClick={handleAdd} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {schools?.map(school => (
                    <div key={school.id} className="border border-border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between p-3 bg-muted/30">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setExpandedId(expandedId === school.id ? null : school.id)} className="p-0.5">
                                    {expandedId === school.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                                <span className="text-sm font-medium">{school.name}</span>
                                {school.classes?.length > 0 && <span className="text-xs text-muted-foreground">({school.classes.length} sınıf)</span>}
                            </div>
                            <button onClick={() => onDelete(school.id)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        {expandedId === school.id && school.classes?.length > 0 && (
                            <div className="px-3 py-2 bg-muted/10 flex flex-wrap gap-1.5">
                                {school.classes.map(c => (
                                    <span key={c} className="text-xs px-2 py-0.5 bg-muted rounded">{c}</span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                {!schools?.length && <div className="text-center py-4 text-sm text-muted-foreground">Okul eklenmemiş</div>}
            </div>
        </div>
    );
}

export default function Settings() {
    const [activeCategory, setActiveCategory] = useState('general');
    const [localSettings, setLocalSettings] = useState({});
    const [printModalOpen, setPrintModalOpen] = useState(false);
    const [printSnapshot, setPrintSnapshot] = useState(() => getPrintSettings());
    const queryClient = useQueryClient();
    const { t } = useTranslation();

    const settingCategories = [
        { id: 'general', label: t('settings.categories.general'), icon: Settings2 },
        { id: 'notification', label: t('settings.categories.notification'), icon: Mail },
        { id: 'security', label: t('settings.categories.security'), icon: Shield },
        { id: 'print', label: t('settings.categories.print'), icon: Printer },
        { id: 'backup', label: t('settings.categories.backup'), icon: Database }
    ];

    // Queries for Options
    const { data: shootTypes } = useQuery({ queryKey: ['shootTypes'], queryFn: () => optionsApi.getShootTypes().then(r => r.data) });
    const { data: locations } = useQuery({ queryKey: ['locations'], queryFn: () => optionsApi.getLocations().then(r => r.data) });
    const { data: photographers } = useQuery({ queryKey: ['photographers'], queryFn: () => optionsApi.getPhotographers().then(r => r.data) });

    // Schools
    const { data: schools } = useQuery({ queryKey: ['schools'], queryFn: () => schoolsApi.list().then(r => r.data || []) });
    const createSchoolMutation = useMutation({
        mutationFn: (data) => schoolsApi.create(data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schools'] }); toast.success('Okul eklendi'); }
    });
    const deleteSchoolMutation = useMutation({
        mutationFn: (id) => schoolsApi.delete(id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schools'] }); toast.success('Okul silindi'); }
    });

    // Mutations
    const createShootTypeMutation = useMutation({ mutationFn: (name) => optionsApi.createShootType({ name }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shootTypes'] }); toast.success('Eklendi'); } });
    const deleteShootTypeMutation = useMutation({ mutationFn: (id) => optionsApi.deleteShootType(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shootTypes'] }); toast.success('Silindi'); } });

    const createLocationMutation = useMutation({ mutationFn: (name) => optionsApi.createLocation({ name }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locations'] }); toast.success('Eklendi'); } });
    const deleteLocationMutation = useMutation({ mutationFn: (id) => optionsApi.deleteLocation(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locations'] }); toast.success('Silindi'); } });

    const createPhotographerMutation = useMutation({ mutationFn: (name) => optionsApi.createPhotographer({ name }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['photographers'] }); toast.success('Eklendi'); } });
    const deletePhotographerMutation = useMutation({ mutationFn: (id) => optionsApi.deletePhotographer(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['photographers'] }); toast.success('Silindi'); } });


    // Packages
    const { data: packages } = useQuery({ queryKey: ['packages'], queryFn: () => optionsApi.getPackages?.().then(r => r.data).catch(() => []) });
    const createPackageMutation = useMutation({ mutationFn: (data) => optionsApi.createPackage?.(data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['packages'] }); toast.success('Paket eklendi'); } });
    const deletePackageMutation = useMutation({ mutationFn: (id) => optionsApi.deletePackage?.(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['packages'] }); toast.success('Paket silindi'); } });

    const { data: settings, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsApi.getAll().then(res => res.data)
    });

    // Sync localSettings when settings data changes
    useEffect(() => {
        if (settings) {
            setLocalSettings(prev => {
                if (Object.keys(prev).length === 0) return settings;
                // Deep merge: keep local edits but fill in any missing server values
                const merged = { ...settings };
                for (const [cat, vals] of Object.entries(prev)) {
                    merged[cat] = { ...(settings[cat] || {}), ...vals };
                }
                return merged;
            });
        }
    }, [settings]);

    const updateMutation = useMutation({
        mutationFn: (updates) => settingsApi.update(updates),
        onSuccess: () => {
            toast.success('Ayarlar kaydedildi');
            // Don't invalidate immediately - let user see the success message
            // Refetch settings after a short delay to avoid render flash
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['settings'] });
            }, 500);
        }
    });

    const updateLocal = (cat, key, val) => setLocalSettings({ ...localSettings, [cat]: { ...localSettings[cat], [key]: val } });

    const saveSettings = () => {
        updateMutation.mutate(localSettings);
    };

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div>;

    const api = localSettings.api || {};
    const general = localSettings.general || {};

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div><h1 className="text-2xl font-bold">{t('settings.title')}</h1><p className="text-muted-foreground">{t('settings.subtitle')}</p></div>
                {activeCategory !== 'options' && (
                    <button onClick={saveSettings} disabled={updateMutation.isPending} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                        {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t('common.save')}
                    </button>
                )}
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-48 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
                    {settingCategories.map(c => (
                        <button key={c.id} onClick={() => setActiveCategory(c.id)} className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg', activeCategory === c.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                            <c.icon className="w-4 h-4" /> {c.label}
                        </button>
                    ))}
                    <button onClick={() => setActiveCategory('options')} className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg', activeCategory === 'options' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                        <FolderOpen className="w-4 h-4" /> {t('settings.categories.options')}
                    </button>
                </div>

                <div className="flex-1 space-y-6">
                    {activeCategory === 'general' && (
                        <>
                            <div className="bg-card border border-border rounded-xl p-6">
                                <h2 className="text-lg font-semibold mb-4">Genel Ayarlar</h2>
                                <div className="py-3">
                                    <label className="block font-medium mb-1">Stüdyo Adı</label>
                                    <input type="text" value={general.studio_name || ''} disabled className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-input text-muted-foreground cursor-not-allowed" />
                                    <p className="text-xs text-muted-foreground mt-1">Bu alan Creator Panel'den güncellenir</p>
                                </div>
                                <div className="py-3">
                                    <label className="block font-medium mb-1">Telefon</label>
                                    <input type="text" value={general.studio_phone || ''} disabled className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-input text-muted-foreground cursor-not-allowed" />
                                    <p className="text-xs text-muted-foreground mt-1">Bu alan Creator Panel'den güncellenir</p>
                                </div>
                                <div className="py-3">
                                    <label className="block font-medium mb-1">E-posta</label>
                                    <input type="text" value={general.studio_email || ''} disabled className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-input text-muted-foreground cursor-not-allowed" />
                                    <p className="text-xs text-muted-foreground mt-1">Bu alan Creator Panel'den güncellenir</p>
                                </div>

                                {/* Archive Folder Path */}
                                <div className="py-3">
                                    <label className="block font-medium mb-1">Arşiv Klasör Yolu</label>
                                    <p className="text-sm text-muted-foreground mb-2">Arşiv klasörlerinin oluşturulacağı ana dizin</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={general.archive_base_path || ''}
                                            onChange={(e) => updateLocal('general', 'archive_base_path', e.target.value)}
                                            placeholder="Örn: D:\Arsiv"
                                            className="flex-1 px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (window.electron?.selectFolder) {
                                                    try {
                                                        const path = await window.electron.selectFolder();
                                                        if (path) {
                                                            updateLocal('general', 'archive_base_path', path);
                                                        }
                                                    } catch (error) {
                                                        console.error('Folder select error:', error);
                                                        toast.error('Klasör seçimi başarısız');
                                                    }
                                                } else {
                                                    console.warn('Electron API not found');
                                                    toast.error('Bu özellik sadece masaüstü uygulamasında çalışır. Tarayıcıda iseniz manuel yazınız.');
                                                }
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted"
                                        >
                                            <FolderOpen className="w-4 h-4" />
                                            Gözat
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* WhatsApp - sadece stüdyo sorumlusu bağlar */}
                            <WhatsAppCard
                                enabled={api.whatsapp_enabled}
                                onToggle={() => updateLocal('api', 'whatsapp_enabled', !api.whatsapp_enabled)}
                            />
                        </>
                    )}

                    {activeCategory === 'options' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <DataList
                                title="Çekim Türleri"
                                items={shootTypes}
                                withColor
                                onAdd={(data) => createShootTypeMutation.mutate(typeof data === 'string' ? data : data.name)}
                                onDelete={(id) => deleteShootTypeMutation.mutate(id)}
                                onColorChange={(id, color) => {
                                    optionsApi.saveShootType({ id, color }).then(() => {
                                        queryClient.invalidateQueries({ queryKey: ['shootTypes'] });
                                    }).catch(() => toast.error('Renk güncellenemedi'));
                                }}
                            />
                            <DataList
                                title="Çekim Yerleri"
                                items={locations}
                                onAdd={(name) => createLocationMutation.mutate(name)}
                                onDelete={(id) => deleteLocationMutation.mutate(id)}
                            />
                            <DataList
                                title="Fotoğrafçılar"
                                items={photographers}
                                onAdd={(name) => createPhotographerMutation.mutate(name)}
                                onDelete={(id) => deletePhotographerMutation.mutate(id)}
                            />
                            <PackageList
                                items={packages}
                                onAdd={(data) => createPackageMutation.mutate(data)}
                                onDelete={(id) => deletePackageMutation.mutate(id)}
                            />
                            <SchoolManager
                                schools={schools}
                                onCreate={(data) => createSchoolMutation.mutate(data)}
                                onDelete={(id) => deleteSchoolMutation.mutate(id)}
                            />
                        </div>
                    )}


                    {activeCategory === 'notification' && (
                        <div className="bg-card border border-border rounded-xl p-6">
                            <h2 className="text-lg font-semibold mb-4">Bildirim Ayarları</h2>
                            <div className="space-y-4">
                                <SettingInput type="boolean" label="Otomatik Hatırlatıcılar" description="Randevulardan önce otomatik bildirim gönder" value={localSettings.notification?.auto_reminder_enabled} onChange={v => updateLocal('notification', 'auto_reminder_enabled', v)} />
                                <SettingInput type="number" label="Hatırlatma Süresi (Saat)" value={localSettings.notification?.reminder_hours_before} onChange={v => updateLocal('notification', 'reminder_hours_before', v)} />
                            </div>
                        </div>
                    )}

                    {activeCategory === 'security' && (
                        <div className="space-y-6">
                            <div className="bg-card border border-border rounded-xl p-6">
                                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Shield className="w-5 h-5" /> Güvenlik Ayarları
                                </h2>
                                <div className="space-y-4">
                                    <div className="py-3">
                                        <label className="block font-medium mb-1">Oturum Süresi</label>
                                        <p className="text-sm text-muted-foreground mb-2">İnaktif kaldıktan sonra otomatik çıkış süresi</p>
                                        <select value={localSettings.security?.session_timeout || '30'}
                                            onChange={(e) => updateLocal('security', 'session_timeout', e.target.value)}
                                            className="px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none">
                                            <option value="15">15 dakika</option>
                                            <option value="30">30 dakika</option>
                                            <option value="60">1 saat</option>
                                            <option value="240">4 saat</option>
                                            <option value="0">Sınırsız</option>
                                        </select>
                                    </div>

                                    <div className="py-3">
                                        <label className="block font-medium mb-1">Çalışma Saatleri</label>
                                        <p className="text-sm text-muted-foreground mb-2">Sistemin aktif olduğu saat aralığı</p>
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-muted-foreground" />
                                            <input type="time" value={localSettings.security?.work_start || '09:00'}
                                                onChange={(e) => updateLocal('security', 'work_start', e.target.value)}
                                                className="px-3 py-2 rounded-lg bg-background border border-input outline-none" />
                                            <span className="text-muted-foreground">—</span>
                                            <input type="time" value={localSettings.security?.work_end || '19:00'}
                                                onChange={(e) => updateLocal('security', 'work_end', e.target.value)}
                                                className="px-3 py-2 rounded-lg bg-background border border-input outline-none" />
                                        </div>
                                    </div>

                                    <SettingInput type="boolean" label="Sadece Çalışma Saatlerinde Giriş"
                                        description="Çalışma saatleri dışında personel girişini engelle"
                                        value={localSettings.security?.restrict_hours}
                                        onChange={v => updateLocal('security', 'restrict_hours', v)} />
                                </div>
                            </div>

                            {/* Login History */}
                            <div className="bg-card border border-border rounded-xl p-6">
                                <h3 className="font-semibold mb-4 flex items-center gap-2">
                                    <Monitor className="w-4 h-4" /> Son Giriş Geçmişi
                                </h3>
                                <div className="space-y-2">
                                    {(localSettings.security?.loginHistory || [
                                        { user: 'admin', time: new Date().toISOString(), device: 'Bu cihaz' },
                                    ]).slice(0, 10).map((entry, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                                <span className="font-medium">{entry.user}</span>
                                            </div>
                                            <div className="text-muted-foreground">{entry.device}</div>
                                            <div className="text-muted-foreground">{formatDate(entry.time)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Print Tab */}
                    {activeCategory === 'print' && (
                        <div className="space-y-6">
                            <div className="bg-card border border-border rounded-xl p-6">
                                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                                    <Printer className="w-5 h-5" /> F2 Otomatik Yazdırma
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Arşiv formu açıkken <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border border-border font-mono">F2</kbd> tuşuna basıldığında kayıt edilir ve seçili şablonlar otomatik yazdırılır.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                    <div className={cn('p-3 rounded-lg border', printSnapshot.enabled?.receipt ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/30')}>
                                        <div className="text-xs text-muted-foreground mb-1">Kayıt Fişi</div>
                                        <div className="font-medium text-sm truncate">{printSnapshot.printers?.receipt || 'Varsayılan yazıcı'}</div>
                                        <div className="text-xs text-muted-foreground mt-1">{printSnapshot.enabled?.receipt ? `Aktif · ${printSnapshot.copies?.receipt || 1}× kopya` : 'Kapalı'}</div>
                                    </div>
                                    <div className={cn('p-3 rounded-lg border', printSnapshot.enabled?.smallEnvelope ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/30')}>
                                        <div className="text-xs text-muted-foreground mb-1">Küçük Zarf</div>
                                        <div className="font-medium text-sm truncate">{printSnapshot.printers?.smallEnvelope || 'Varsayılan yazıcı'}</div>
                                        <div className="text-xs text-muted-foreground mt-1">{printSnapshot.enabled?.smallEnvelope ? `Aktif · ${printSnapshot.copies?.smallEnvelope || 1}× kopya` : 'Kapalı'}</div>
                                    </div>
                                    <div className={cn('p-3 rounded-lg border', printSnapshot.enabled?.bigEnvelope ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/30')}>
                                        <div className="text-xs text-muted-foreground mb-1">Büyük Zarf</div>
                                        <div className="font-medium text-sm truncate">{printSnapshot.printers?.bigEnvelope || 'Varsayılan yazıcı'}</div>
                                        <div className="text-xs text-muted-foreground mt-1">{printSnapshot.enabled?.bigEnvelope ? `Aktif · ${printSnapshot.copies?.bigEnvelope || 1}× kopya` : 'Kapalı'}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className={cn('px-3 py-1.5 rounded-full text-xs font-medium', printSnapshot.autoPrintOnSave ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground')}>
                                        {printSnapshot.autoPrintOnSave ? '● F2 otomatik yazdırma AÇIK' : '○ F2 otomatik yazdırma KAPALI'}
                                    </div>
                                    <button
                                        onClick={() => setPrintModalOpen(true)}
                                        className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                                    >
                                        <Settings2 className="w-4 h-4" /> Yapılandır
                                    </button>
                                </div>
                            </div>

                            <div className="bg-card border border-border rounded-xl p-6">
                                <h3 className="text-base font-semibold mb-2">Şablon Özellikleri</h3>
                                <div className="text-sm text-muted-foreground space-y-2">
                                    <p><strong className="text-foreground">Kayıt Fişi (200×65mm):</strong> Müşteriye verilen alındı. Ad, tarih, teslim, ebat, tutar/alınan/kalan + Code39 barkod.</p>
                                    <p><strong className="text-foreground">Küçük Zarf (200×65mm):</strong> CD/küçük işler zarfı üzerine. Telefon, e-posta + tüm fiş bilgileri + barkod.</p>
                                    <p><strong className="text-foreground">Büyük Zarf (200×205mm):</strong> Albüm/proof zarfı üzerine. Tüm bilgiler + çekimci, çekim yeri, çekim türü, notlar + büyük barkod.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Backup Tab */}
                    {activeCategory === 'backup' && (
                        <div className="space-y-6">
                            {/* Backup Actions */}
                            <div className="bg-card border border-border rounded-xl p-6">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Database className="w-5 h-5" /> Yedekleme & Geri Yükleme
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4">Veritabanınızın yedeğini alın veya mevcut bir yedekten geri yükleyin.</p>
                                <div className="flex gap-3">
                                    <button onClick={() => {
                                        toast.promise(
                                            backupApi.create().then(() => {
                                                auditLog.log(auditLog.ACTIONS.BACKUP_CREATE, 'Manuel yedekleme oluşturuldu');
                                            }),
                                            { loading: 'Yedek oluşturuluyor...', success: 'Yedek oluşturuldu!', error: 'Yedekleme başarısız' }
                                        );
                                    }} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                                        <Download className="w-4 h-4" /> Yedek Oluştur
                                    </button>
                                    <button onClick={() => {
                                        const localData = {
                                            exportDate: new Date().toISOString(),
                                            settings: localSettings,
                                            auditLog: auditLog.getLocalLogs()
                                        };
                                        backupApi.exportToJson(localData, 'studyo-local-backup');
                                        toast.success('Yerel yedek indirildi');
                                    }} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted">
                                        <Upload className="w-4 h-4" /> Yerel Dışa Aktar
                                    </button>
                                </div>
                            </div>

                            {/* Audit Log */}
                            <div className="bg-card border border-border rounded-xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <Monitor className="w-5 h-5" /> İşlem Geçmişi (Son 20)
                                    </h3>
                                    <button onClick={() => { auditLog.clearLocalLogs(); toast.success('Geçmiş temizlendi'); }}
                                        className="text-xs text-muted-foreground hover:text-foreground">Temizle</button>
                                </div>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {(auditLog.getLocalLogs()).slice(0, 20).map((entry, i) => (
                                        <div key={i} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono px-1.5 py-0.5 bg-primary/10 text-primary rounded">{entry.action}</span>
                                                <span className="text-muted-foreground">{entry.userName}</span>
                                            </div>
                                            <span className="text-muted-foreground">{formatDate(entry.timestamp)}</span>
                                        </div>
                                    ))}
                                    {auditLog.getLocalLogs().length === 0 && (
                                        <p className="text-center text-sm text-muted-foreground py-4">Henüz işlem kaydı yok</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <PrintSettingsModal
                open={printModalOpen}
                onClose={() => {
                    setPrintModalOpen(false);
                    setPrintSnapshot(getPrintSettings());
                }}
            />
        </div >
    );
}

/**
 * Settings — Orchestrator (refactored)
 * Alt-bileşenler: WhatsAppSettings, OptionsSettings
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { settingsApi } from '../services/api';
import { cn, formatDate } from '../lib/utils';
import {
    Settings2, Mail, Shield,
    Save, Loader2, Eye, EyeOff, FolderOpen,
    Clock, Monitor, Database, Download, Upload,
    Printer
} from 'lucide-react';
import notify from '../lib/notify';
import { backupApi } from '../services/backup';
import auditLog from '../services/auditLog';
import PrintSettingsModal from '../components/PrintSettingsModal';
import { getPrintSettings } from '../lib/printSettings';

import WhatsAppSettings from './settings/WhatsAppSettings';
import OptionsSettings from './settings/OptionsSettings';

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
                    aria-checked={!!value}
                    role="switch"
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

    const { data: settings, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsApi.getAll().then(res => res.data)
    });

    useEffect(() => {
        if (settings) {
            setLocalSettings(prev => {
                if (Object.keys(prev).length === 0) return settings;
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
            notify.success('Ayarlar kaydedildi');
            setTimeout(() => queryClient.invalidateQueries({ queryKey: ['settings'] }), 500);
        }
    });

    const updateLocal = (cat, key, val) => setLocalSettings({ ...localSettings, [cat]: { ...localSettings[cat], [key]: val } });

    const saveSettings = () => updateMutation.mutate(localSettings);

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
                        <button key={c.id} onClick={() => setActiveCategory(c.id)}
                            className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg', activeCategory === c.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                            <c.icon className="w-4 h-4" /> {c.label}
                        </button>
                    ))}
                    <button onClick={() => setActiveCategory('options')}
                        className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg', activeCategory === 'options' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
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
                                <div className="py-3">
                                    <label className="block font-medium mb-1">Arşiv Klasör Yolu</label>
                                    <p className="text-sm text-muted-foreground mb-2">Arşiv klasörlerinin oluşturulacağı ana dizin</p>
                                    <div className="flex gap-2">
                                        <input type="text" value={general.archive_base_path || ''}
                                            onChange={(e) => updateLocal('general', 'archive_base_path', e.target.value)}
                                            placeholder="Örn: D:\Arsiv"
                                            className="flex-1 px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                                        <button type="button" onClick={async () => {
                                            if (window.electron?.selectFolder) {
                                                try {
                                                    const path = await window.electron.selectFolder();
                                                    if (path) updateLocal('general', 'archive_base_path', path);
                                                } catch (error) {
                                                    notify.error('Klasör seçimi başarısız');
                                                }
                                            } else {
                                                notify.error('Bu özellik sadece masaüstü uygulamasında çalışır.');
                                            }
                                        }} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted">
                                            <FolderOpen className="w-4 h-4" /> Gözat
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <WhatsAppSettings
                                enabled={api.whatsapp_enabled}
                                onToggle={() => updateLocal('api', 'whatsapp_enabled', !api.whatsapp_enabled)}
                            />
                        </>
                    )}

                    {activeCategory === 'options' && <OptionsSettings />}

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
                                    {['receipt', 'smallEnvelope', 'bigEnvelope'].map((key) => {
                                        const labels = { receipt: 'Kayıt Fişi', smallEnvelope: 'Küçük Zarf', bigEnvelope: 'Büyük Zarf' };
                                        return (
                                            <div key={key} className={cn('p-3 rounded-lg border', printSnapshot.enabled?.[key] ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/30')}>
                                                <div className="text-xs text-muted-foreground mb-1">{labels[key]}</div>
                                                <div className="font-medium text-sm truncate">{printSnapshot.printers?.[key] || 'Varsayılan yazıcı'}</div>
                                                <div className="text-xs text-muted-foreground mt-1">{printSnapshot.enabled?.[key] ? `Aktif · ${printSnapshot.copies?.[key] || 1}× kopya` : 'Kapalı'}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={cn('px-3 py-1.5 rounded-full text-xs font-medium', printSnapshot.autoPrintOnSave ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground')}>
                                        {printSnapshot.autoPrintOnSave ? '● F2 otomatik yazdırma AÇIK' : '○ F2 otomatik yazdırma KAPALI'}
                                    </div>
                                    <button onClick={() => setPrintModalOpen(true)}
                                        className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
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

                    {activeCategory === 'backup' && (
                        <div className="space-y-6">
                            <div className="bg-card border border-border rounded-xl p-6">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Database className="w-5 h-5" /> Yedekleme & Geri Yükleme
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4">Veritabanınızın yedeğini alın veya mevcut bir yedekten geri yükleyin.</p>
                                <div className="flex gap-3">
                                    <button onClick={() => {
                                        notify.promise(
                                            backupApi.create().then(() => {
                                                auditLog.log(auditLog.ACTIONS.BACKUP_CREATE, 'Manuel yedekleme oluşturuldu');
                                            }),
                                            { loading: 'Yedek oluşturuluyor...', success: 'Yedek oluşturuldu!', error: 'Yedekleme başarısız' }
                                        );
                                    }} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                                        <Download className="w-4 h-4" /> Yedek Oluştur
                                    </button>
                                    <button onClick={() => {
                                        const localData = { exportDate: new Date().toISOString(), settings: localSettings, auditLog: auditLog.getLocalLogs() };
                                        backupApi.exportToJson(localData, 'studyo-local-backup');
                                        notify.success('Yerel yedek indirildi');
                                    }} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted">
                                        <Upload className="w-4 h-4" /> Yerel Dışa Aktar
                                    </button>
                                </div>
                            </div>
                            <div className="bg-card border border-border rounded-xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <Monitor className="w-5 h-5" /> İşlem Geçmişi (Son 20)
                                    </h3>
                                    <button onClick={() => { auditLog.clearLocalLogs(); notify.success('Geçmiş temizlendi'); }}
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
                onClose={() => { setPrintModalOpen(false); setPrintSnapshot(getPrintSettings()); }}
            />
        </div>
    );
}

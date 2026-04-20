import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Printer, Check, X, Loader2, AlertCircle, Eye } from 'lucide-react';
import { getPrintSettings, savePrintSettings } from '../lib/printSettings';
import { listPrinters, printTemplate, isPrintAvailable } from '../lib/printService';

const TEMPLATE_LABELS = {
    receipt: 'Kayıt Fişi',
    smallEnvelope: 'Küçük Zarf',
    bigEnvelope: 'Büyük Zarf'
};

const TEMPLATE_DESCRIPTIONS = {
    receipt: '200×65 mm — müşteriye verilen alındı fişi',
    smallEnvelope: '200×65 mm — fotoğraf CD zarfı üzerine',
    bigEnvelope: '200×205 mm — albüm/proof zarfı üzerine'
};

const SAMPLE_ARCHIVE = {
    archiveNumber: '12345',
    fullName: 'DEMO MÜŞTERİ',
    phone: '05551234567',
    email: 'demo@ornek.com',
    shootDate: new Date(),
    deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    size: '6 VS + 1 Albüm',
    photographer: 'Mehmet Demir',
    shootLocation: 'Stüdyo',
    shootType: 'Aile',
    totalAmount: 1500,
    paidAmount: 500,
    remainingAmount: 1000,
    notes: 'Örnek yazdırma testi',
    webPassword: 'ab12x'
};

export default function PrintSettingsModal({ open, onClose }) {
    const [settings, setSettings] = useState(() => getPrintSettings());
    const [printers, setPrinters] = useState([]);
    const [loadingPrinters, setLoadingPrinters] = useState(false);
    const [testing, setTesting] = useState(null);
    const available = isPrintAvailable();

    useEffect(() => {
        if (!open) return;
        setSettings(getPrintSettings());
        if (!available) return;
        setLoadingPrinters(true);
        listPrinters()
            .then(setPrinters)
            .catch((e) => {
                console.error('[PrintSettings] listPrinters:', e);
                toast.error('Yazıcı listesi alınamadı');
            })
            .finally(() => setLoadingPrinters(false));
    }, [open, available]);

    const update = (patch) => setSettings(s => ({ ...s, ...patch }));
    const updateNested = (key, sub, val) => setSettings(s => ({
        ...s,
        [key]: { ...s[key], [sub]: val }
    }));

    const handleSave = () => {
        savePrintSettings(settings);
        toast.success('Yazdırma ayarları kaydedildi');
        onClose?.();
    };

    const handleTest = async (type) => {
        setTesting(type);
        try {
            const res = await printTemplate(type, SAMPLE_ARCHIVE, {
                deviceName: settings.printers[type] || undefined,
                copies: 1,
                silent: !!settings.printers[type]
            });
            if (res?.success) {
                toast.success(`${TEMPLATE_LABELS[type]}: test çıktısı gönderildi`);
            } else {
                toast.error(`Test başarısız: ${res?.failureReason || 'bilinmeyen hata'}`);
            }
        } catch (e) {
            toast.error('Test yazdırma hatası: ' + (e?.message || e));
        } finally {
            setTesting(null);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="print-settings-title"
                className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-border flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><Printer className="w-5 h-5 text-primary" /></div>
                    <div className="flex-1">
                        <h2 id="print-settings-title" className="text-lg font-semibold">Yazdırma Ayarları</h2>
                        <p className="text-xs text-muted-foreground">F2 otomatik yazdırma — şablon başına yazıcı eşleme</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg" aria-label="Kapat">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {!available && (
                        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>Yazdırma servisi yalnızca masaüstü uygulamasında çalışır. Tarayıcıda ayarlar kaydedilir ama test yapılamaz.</span>
                        </div>
                    )}

                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                        <div className="flex-1 pr-4">
                            <label className="font-medium block" htmlFor="auto-print-toggle">F2 ile otomatik yazdır</label>
                            <p className="text-xs text-muted-foreground">Arşiv kaydedildiğinde aşağıdaki aktif şablonlar otomatik basılır</p>
                        </div>
                        <button
                            id="auto-print-toggle"
                            type="button"
                            role="switch"
                            aria-checked={settings.autoPrintOnSave}
                            onClick={() => update({ autoPrintOnSave: !settings.autoPrintOnSave })}
                            className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${settings.autoPrintOnSave ? 'bg-primary' : 'bg-input/50'}`}
                        >
                            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${settings.autoPrintOnSave ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    {['receipt', 'smallEnvelope', 'bigEnvelope'].map(type => (
                        <div key={type} className="p-4 border border-border rounded-lg space-y-3">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="font-medium">{TEMPLATE_LABELS[type]}</div>
                                    <p className="text-xs text-muted-foreground">{TEMPLATE_DESCRIPTIONS[type]}</p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={settings.enabled[type]}
                                    aria-label={`${TEMPLATE_LABELS[type]} aktif`}
                                    onClick={() => updateNested('enabled', type, !settings.enabled[type])}
                                    className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${settings.enabled[type] ? 'bg-primary' : 'bg-input/50'}`}
                                >
                                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${settings.enabled[type] ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-[1fr_70px_auto] gap-2 items-end">
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1">Yazıcı</label>
                                    <select
                                        value={settings.printers[type] || ''}
                                        onChange={(e) => updateNested('printers', type, e.target.value)}
                                        disabled={loadingPrinters || !settings.enabled[type]}
                                        className="w-full px-3 py-2 rounded-lg bg-background border border-input text-sm disabled:opacity-50"
                                    >
                                        <option value="">— Varsayılan yazıcı —</option>
                                        {printers.map(p => (
                                            <option key={p.name} value={p.name}>{p.displayName || p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1">Kopya</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={settings.copies[type]}
                                        onChange={(e) => updateNested('copies', type, Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                                        disabled={!settings.enabled[type]}
                                        className="w-full px-2 py-2 rounded-lg bg-background border border-input text-sm disabled:opacity-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1">&nbsp;</label>
                                    <button
                                        type="button"
                                        onClick={() => handleTest(type)}
                                        disabled={!settings.enabled[type] || testing === type || !available}
                                        className="px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm flex items-center gap-2 disabled:opacity-50 w-full justify-center"
                                    >
                                        {testing === type ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                                        Test
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
                        <p className="font-medium mb-1">💡 İpuçları</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            <li>Yazıcı seçilmezse Windows varsayılanı kullanılır.</li>
                            <li>"Sessiz baskı" için her şablona yazıcı atayın (aksi halde Windows print dialog açılır).</li>
                            <li>F2 ile otomatik yazdırma aktif değilken yine de arşiv satırlarındaki "Yazdır" butonu çalışır.</li>
                        </ul>
                    </div>
                </div>

                <div className="p-6 border-t border-border flex justify-end gap-3 bg-muted/20">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border hover:bg-muted">Vazgeç</button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
                    >
                        <Check className="w-4 h-4" /> Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
}

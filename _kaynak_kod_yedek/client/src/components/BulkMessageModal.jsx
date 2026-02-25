import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { archivesApi, whatsappApi } from '../services/api';
import { cn } from '../lib/utils';
import {
    X, Search, Plus, Trash2, ChevronRight, MessageCircle,
    Loader2, Send, CheckCircle, AlertCircle, Users
} from 'lucide-react';
import toast from 'react-hot-toast';

const messageTemplates = [
    { key: '', label: 'Şablon Seçin...' },
    { key: 'appointment', label: 'Randevu Hatırlatma', text: 'Merhaba {{isim}}, {{tarih}} tarihli randevunuzu hatırlatmak isteriz. Stüdyomuzda görüşmek üzere!' },
    { key: 'photos_ready', label: 'Fotoğraflar Hazır', text: 'Merhaba {{isim}}, fotoğraflarınız hazırlanmıştır. Görüntülemek için stüdyomuza bekleriz. Şifreniz: {{sifre}}' },
    { key: 'payment', label: 'Ödeme Hatırlatma', text: 'Merhaba {{isim}}, {{tutar}} tutarında ödemeniz bulunmaktadır. Ödemenizi en kısa sürede gerçekleştirmenizi rica ederiz.' },
    { key: 'promo', label: 'Kampanya Duyurusu', text: 'Merhaba {{isim}}, stüdyomuzda özel kampanya başladı! Detaylar için bize ulaşın.' },
    { key: 'custom', label: 'Özel Mesaj', text: '' }
];

export default function BulkMessageModal({ onClose }) {
    const [step, setStep] = useState(1);
    const [search, setSearch] = useState('');
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [templateKey, setTemplateKey] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0, errors: 0 });

    // Fetch archives for customer selection
    const { data: archiveData, isLoading } = useQuery({
        queryKey: ['archives-for-bulk', search],
        queryFn: () => archivesApi.list({ search, limit: 30 }),
        enabled: step === 1
    });

    const archives = archiveData?.archives || archiveData?.data || [];

    const addCustomer = (archive) => {
        if (selectedCustomers.find(c => c.phone === archive.phone)) {
            toast.error('Bu müşteri zaten ekli');
            return;
        }
        setSelectedCustomers(prev => [...prev, {
            id: archive.id,
            name: archive.fullName || archive.customerName || '-',
            phone: archive.phone || '',
            archiveNumber: archive.archiveNumber || ''
        }]);
    };

    const removeCustomer = (phone) => {
        setSelectedCustomers(prev => prev.filter(c => c.phone !== phone));
    };

    const handleTemplateChange = (key) => {
        setTemplateKey(key);
        const tpl = messageTemplates.find(t => t.key === key);
        if (tpl && tpl.text) setMessage(tpl.text);
    };

    const handleSend = async () => {
        if (!message.trim()) { toast.error('Mesaj boş olamaz'); return; }
        if (!selectedCustomers.length) { toast.error('Müşteri seçin'); return; }

        setSending(true);
        setSendProgress({ sent: 0, total: selectedCustomers.length, errors: 0 });

        let errors = 0;
        for (let i = 0; i < selectedCustomers.length; i++) {
            const customer = selectedCustomers[i];
            const personalMessage = message
                .replace(/\{\{isim\}\}/g, customer.name)
                .replace(/\{\{telefon\}\}/g, customer.phone)
                .replace(/\{\{arsiv\}\}/g, customer.archiveNumber);

            try {
                await whatsappApi.send({ phone: customer.phone, message: personalMessage });
            } catch {
                errors++;
            }

            setSendProgress({ sent: i + 1, total: selectedCustomers.length, errors });

            // Random delay: 2-5 seconds between messages
            if (i < selectedCustomers.length - 1) {
                await new Promise(r => setTimeout(r, Math.random() * 3000 + 2000));
            }
        }

        setSending(false);
        toast.success(`${selectedCustomers.length - errors} mesaj gönderildi${errors > 0 ? `, ${errors} hata` : ''}`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <MessageCircle className="w-5 h-5" />
                        Toplu Mesaj {step === 1 ? '— Müşteri Seçimi' : '— Mesaj Yazma'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {step === 1 ? (
                        /* STEP 1: Customer Selection */
                        <div className="grid grid-cols-2 gap-6 h-full">
                            {/* Left: Archive search */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-muted-foreground">Arşivden Müşteri Ara</h3>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                        placeholder="İsim veya telefon..."
                                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-background border border-input outline-none" />
                                </div>
                                <div className="space-y-1 max-h-[350px] overflow-auto">
                                    {isLoading ? (
                                        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
                                    ) : archives.length > 0 ? archives.map(a => (
                                        <div key={a.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted group">
                                            <div>
                                                <p className="text-sm font-medium">{a.fullName || a.customerName}</p>
                                                <p className="text-xs text-muted-foreground">{a.phone} • {a.archiveNumber}</p>
                                            </div>
                                            <button onClick={() => addCustomer(a)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )) : (
                                        <p className="text-center py-4 text-sm text-muted-foreground">Sonuç yok</p>
                                    )}
                                </div>
                            </div>

                            {/* Right: Selected customers */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                    <Users className="w-4 h-4" /> Seçilen Müşteriler ({selectedCustomers.length})
                                </h3>
                                <div className="space-y-1 max-h-[400px] overflow-auto">
                                    {selectedCustomers.map(c => (
                                        <div key={c.phone} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                                            <div>
                                                <p className="text-sm font-medium">{c.name}</p>
                                                <p className="text-xs text-muted-foreground">{c.phone}</p>
                                            </div>
                                            <button onClick={() => removeCustomer(c.phone)}
                                                className="p-1.5 text-destructive hover:bg-destructive/10 rounded">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {selectedCustomers.length === 0 && (
                                        <p className="text-center py-8 text-sm text-muted-foreground">
                                            Soldan müşteri ekleyin
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* STEP 2: Message composition */
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg text-sm">
                                <Users className="w-4 h-4" />
                                <span><strong>{selectedCustomers.length}</strong> müşteriye gönderilecek</span>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Mesaj Şablonu</label>
                                <select value={templateKey} onChange={e => handleTemplateChange(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none">
                                    {messageTemplates.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Mesaj</label>
                                <textarea value={message} onChange={e => setMessage(e.target.value)}
                                    rows={6} placeholder="Mesajınızı yazın... {{isim}}, {{telefon}}, {{arsiv}} değişkenleri kullanılabilir."
                                    className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none resize-none font-mono text-sm" />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Değişkenler: {'{{isim}}'}, {'{{telefon}}'}, {'{{arsiv}}'}
                                </p>
                            </div>

                            {/* Send progress */}
                            {sending && (
                                <div className="p-4 border border-border rounded-lg space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" /> Gönderiliyor...
                                        </span>
                                        <span className="font-medium">{sendProgress.sent}/{sendProgress.total}</span>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-2">
                                        <div className="bg-primary h-2 rounded-full transition-all"
                                            style={{ width: `${(sendProgress.sent / sendProgress.total) * 100}%` }} />
                                    </div>
                                    {sendProgress.errors > 0 && (
                                        <p className="text-xs text-destructive flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" /> {sendProgress.errors} hata
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                    {step === 1 ? (
                        <>
                            <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg hover:bg-muted">İptal</button>
                            <button onClick={() => setStep(2)} disabled={selectedCustomers.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                                İleri <ChevronRight className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setStep(1)} disabled={sending}
                                className="px-4 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50">Geri</button>
                            <button onClick={handleSend} disabled={sending || !message.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {sending ? `${sendProgress.sent}/${sendProgress.total} Gönderiliyor...` : 'Gönder'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { whatsappApi } from '../../services/api';
import { X, Loader2, MessageCircle, ExternalLink } from 'lucide-react';
import notify from '../../lib/notify';

export default function WhatsAppModal({ isOpen, onClose, archive }) {
    const { t } = useTranslation();
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { if (isOpen) setMessage(''); }, [isOpen]);

    const handleSend = async () => {
        if (!message) return notify.error(t('common.error'));
        setLoading(true);
        try {
            await whatsappApi.send({ phone: archive.phone, message });
            notify.success(t('pages.archives.sendMessage'));
            onClose();
        } catch (error) {
            notify.error(error.response?.data?.error || t('common.error'));
        }
        setLoading(false);
    };

    const paidAmount = (archive?.cashAmount || 0) + (archive?.cardAmount || 0) + (archive?.transferAmount || 0);
    const remainingAmount = (archive?.totalAmount || 0) - paidAmount;

    const presets = [
        { label: t('pages.archives.appointmentInfo'), text: `Sayın ${archive?.fullName},\n\nRandevunuz oluşturulmuştur.\n\nTeşekkürler, ${archive?.shootType?.name || 'Stüdyo'}` },
        { label: t('pages.archives.photosReady'), text: `Sayın ${archive?.fullName},\n\nFotoğraflarınız hazırdır. Stüdyomuzdan teslim alabilirsiniz.\n\nİyi günler dileriz.` },
        { label: t('pages.archives.paymentReminder'), text: `Sayın ${archive?.fullName},\n\nÖdemenizle ilgili hatırlatmadır.${remainingAmount > 0 ? `\n\nKalan tutar: ${remainingAmount.toLocaleString('tr-TR')} ₺` : ''}\n\nTeşekkürler.` },
        { label: t('pages.archives.thankYou'), text: `Sayın ${archive?.fullName},\n\nBizi tercih ettiğiniz için teşekkür ederiz.` }
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 select-text">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <MessageCircle className="w-5 h-5 text-green-500" /> {t('pages.archives.whatsappMessageTitle')}
                        </h2>
                        <p className="text-sm text-muted-foreground">{archive?.fullName} ({archive?.phone})</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        {presets.map((preset, i) => (
                            <button key={i} onClick={() => setMessage(preset.text)}
                                className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted text-left transition-colors">
                                {preset.label}
                            </button>
                        ))}
                    </div>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)}
                        placeholder={t('components.bulkMessage.message')}
                        className="w-full h-32 px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none resize-none" />
                    <div className="flex gap-3 pt-2">
                        <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">
                            {t('pages.archives.cancel')}
                        </button>
                        <button onClick={() => {
                            const phone = archive?.phone?.replace(/[^0-9]/g, '');
                            const formatted = phone?.startsWith('0') ? '90' + phone.slice(1) : phone;
                            const url = `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
                            if (window.electron?.openExternal) window.electron.openExternal(url);
                            else window.open(url, '_blank');
                            onClose();
                        }} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
                            <ExternalLink className="w-4 h-4" /> {t('pages.archives.openInWhatsapp')}
                        </button>
                        <button onClick={handleSend} disabled={loading || !message}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                            {t('pages.archives.sendMessage')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

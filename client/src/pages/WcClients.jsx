import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { whatsappApi } from '../services/api';
import { woocommerceApi } from '../services/api';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
    Globe, Link2, Copy, Check, MessageCircle, ExternalLink,
    Loader2, Search, RefreshCw, ShoppingCart, Package
} from 'lucide-react';
import notify from '../lib/notify';
import { cn } from '../lib/utils';
import WooCommerceModal from '../components/WooCommerceModal';

export default function WcClients() {
    const { t } = useTranslation();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedId, setCopiedId] = useState(null);
    const [selectedArchive, setSelectedArchive] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async () => {
        setLoading(true);
        try {
            const { data } = await woocommerceApi.getClients();
            setClients(data);
        } catch (error) {
            console.error('Error loading WC clients:', error);
            notify.error(t('common.failed'));
        }
        setLoading(false);
    };

    const copyLink = (link, id) => {
        navigator.clipboard.writeText(link);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
        notify.success(t('woocommerce.copySuccess'));
    };

    const sendWhatsApp = async (client) => {
        const message = t('woocommerce.messagePrefix', { name: client.fullName }) + '\n\n' +
                       t('woocommerce.messagePhotosReady') + '\n\n' +
                       `${client.wcLink}\n` +
                       t('woocommerce.password') + ' ${client.wcPassword}\n\n' +
                       t('woocommerce.bestRegards');

        try {
            await whatsappApi.send({ phone: client.phone, message });
            notify.success(t('woocommerce.sendMessage'));
        } catch (error) {
            notify.error(t('woocommerce.sendError'));
        }
    };

    const openModal = (client) => {
        setSelectedArchive(client);
        setModalOpen(true);
    };

    const filteredClients = clients.filter(c =>
        c.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                        <Globe className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">{t('nav.onlineSales')}</h1>
                        <p className="text-sm text-muted-foreground">
                            {t('pages.wcClients.title')}
                        </p>
                    </div>
                </div>
                <button
                    onClick={loadClients}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    {t('common.refresh')}
                </button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder={t('pages.wcClients.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <Link2 className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{clients.length}</p>
                            <p className="text-sm text-muted-foreground">{t('pages.finance.activeLinks')}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/10">
                            <ShoppingCart className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">
                                {clients.filter(c => c.hasOrders).length}
                            </p>
                            <p className="text-sm text-muted-foreground">{t('pages.finance.withOrders')}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                            <Package className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">
                                {clients.filter(c => !c.hasOrders).length}
                            </p>
                            <p className="text-sm text-muted-foreground">{t('pages.finance.pending')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Client List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : filteredClients.length === 0 ? (
                <div className="text-center py-12">
                    <Globe className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">{t('pages.wcClients.noClients')}</h3>
                    <p className="text-sm text-muted-foreground">
                        {t('pages.wcClients.createLinks')}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredClients.map((client) => (
                        <div
                            key={client.id}
                            className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-semibold text-lg truncate">
                                            {client.fullName}
                                        </h3>
                                        <span className={cn(
                                            "text-xs px-2 py-0.5 rounded-full",
                                            client.hasOrders
                                                ? "bg-green-500/10 text-green-500"
                                                : "bg-yellow-500/10 text-yellow-500"
                                        )}>
                                            {client.hasOrders ? t('pages.finance.hasOrders') : t('pages.finance.pending')}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 mb-3">
                                        <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-md">
                                            {client.wcLink}
                                        </code>
                                        <button
                                            onClick={() => copyLink(client.wcLink, client.id)}
                                            className="p-1.5 hover:bg-muted rounded transition-colors"
                                        >
                                            {copiedId === client.id ? (
                                                <Check className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <Copy className="w-4 h-4 text-muted-foreground" />
                                            )}
                                        </button>
                                        <a
                                            href={client.wcLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 hover:bg-muted rounded transition-colors"
                                        >
                                            <ExternalLink className="w-4 h-4 text-muted-foreground" />
                                        </a>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <span>📱 {client.phone}</span>
                                        <span>🔑 {client.wcPassword}</span>
                                        <span>📅 {client.wcUploadedAt ? format(new Date(client.wcUploadedAt), 'dd MMM yyyy', { locale: tr }) : '-'} ({t('pages.wcClients.uploadedDate')})</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => sendWhatsApp(client)}
                                        className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
                                    >
                                        <MessageCircle className="w-4 h-4" />
                                        WhatsApp
                                    </button>
                                    <button
                                        onClick={() => openModal(client)}
                                        className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
                                    >
                                        <Globe className="w-4 h-4" />
                                        Detay
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* WooCommerce Modal */}
            <WooCommerceModal
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    loadClients();
                }}
                archive={selectedArchive}
            />
        </div>
    );
}

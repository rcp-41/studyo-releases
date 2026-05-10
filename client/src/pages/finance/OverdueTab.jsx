import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { financeApi, whatsappApi } from '../../services/api';
import { formatCurrency, cn } from '../../lib/utils';
import { CheckSquare, Square, MessageCircle } from 'lucide-react';
import { SkeletonTable } from '../../components/Skeleton';
import notify from '../../lib/notify';

export default function OverdueTab() {
    const { t } = useTranslation();
    const [selected, setSelected] = useState(new Set());

    const { data, isLoading } = useQuery({
        queryKey: ['finance-overdue'],
        queryFn: () => financeApi.getOverduePayments()
    });

    const overdueList = data?.overdue || [];

    const toggleSelect = (id) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelected(next);
    };

    const selectAll = () => {
        if (selected.size === overdueList.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(overdueList.map(o => o.id)));
        }
    };

    const sendWhatsApp = async () => {
        const items = overdueList.filter(o => selected.has(o.id));
        if (!items.length) { notify.error(t('pages.customers.search')); return; }

        for (const item of items) {
            const msg = `${t('woocommerce.messagePrefix', { name: item.customerName })} ${item.archiveNumber} ${t('pages.archives.archiveNumber').toLowerCase()} ait ${formatCurrency(item.remaining)} ${t('common.payment').toLowerCase()} bulunmaktadır.`;
            try {
                await whatsappApi.send({ phone: item.phone, message: msg });
                await new Promise(r => setTimeout(r, Math.random() * 3000 + 2000));
            } catch { /* continue */ }
        }
        notify.success(t('common.success'));
    };

    const totalOverdue = useMemo(() => overdueList.reduce((s, o) => s + (o.remaining || 0), 0), [overdueList]);

    if (isLoading) return <SkeletonTable rows={8} columns={8} />;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="bg-destructive/10 rounded-lg px-4 py-2">
                    <span className="text-sm text-muted-foreground mr-2">Toplam Geciken:</span>
                    <span className="font-bold text-destructive">{formatCurrency(totalOverdue)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({overdueList.length} müşteri)</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={selectAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80">
                        {selected.size === overdueList.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        {selected.size === overdueList.length ? 'Temizle' : 'Tümünü Seç'}
                    </button>
                    <button onClick={sendWhatsApp} disabled={selected.size === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                        <MessageCircle className="w-4 h-4" /> Seçilenlere WhatsApp Gönder
                    </button>
                </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="w-10 px-3 py-2.5"></th>
                            <th className="text-left px-4 py-2.5 font-medium">Müşteri</th>
                            <th className="text-left px-4 py-2.5 font-medium">Telefon</th>
                            <th className="text-left px-4 py-2.5 font-medium">Arşiv No</th>
                            <th className="text-right px-4 py-2.5 font-medium">Toplam</th>
                            <th className="text-right px-4 py-2.5 font-medium">Ödenen</th>
                            <th className="text-right px-4 py-2.5 font-medium">Kalan</th>
                            <th className="text-right px-4 py-2.5 font-medium">Gün</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {overdueList.map((o) => (
                            <tr key={o.id} className="hover:bg-muted/30">
                                <td className="px-3 py-2.5 text-center">
                                    <button onClick={() => toggleSelect(o.id)}>
                                        {selected.has(o.id)
                                            ? <CheckSquare className="w-4 h-4 text-primary" />
                                            : <Square className="w-4 h-4 text-muted-foreground" />}
                                    </button>
                                </td>
                                <td className="px-4 py-2.5 font-medium">{o.customerName}</td>
                                <td className="px-4 py-2.5 text-muted-foreground">{o.phone}</td>
                                <td className="px-4 py-2.5">{o.archiveNumber}</td>
                                <td className="px-4 py-2.5 text-right">{formatCurrency(o.totalAmount)}</td>
                                <td className="px-4 py-2.5 text-right text-green-600">{formatCurrency(o.paidAmount)}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-destructive">{formatCurrency(o.remaining)}</td>
                                <td className="px-4 py-2.5 text-right">
                                    <span className={cn('px-2 py-0.5 rounded text-xs font-medium',
                                        o.daysPassed > 60 ? 'bg-red-500/10 text-red-600' :
                                            o.daysPassed > 30 ? 'bg-orange-500/10 text-orange-600' :
                                                'bg-yellow-500/10 text-yellow-600')}>
                                        {o.daysPassed} gün
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {overdueList.length === 0 && (
                            <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Geciken ödeme yok</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

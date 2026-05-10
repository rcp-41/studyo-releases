import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { financeApi } from '../../services/api';
import { formatDate, formatCurrency, cn } from '../../lib/utils';
import { Search } from 'lucide-react';
import { SkeletonTable } from '../../components/Skeleton';

export default function PaymentsTab({ range }) {
    const { t } = useTranslation();
    const paymentMethods = [
        { value: '', label: t('common.all') },
        { value: 'cash', label: t('pages.finance.cash') },
        { value: 'credit_card', label: t('pages.finance.creditCard') },
        { value: 'transfer', label: t('pages.finance.transfer') }
    ];
    const [search, setSearch] = useState('');
    const [methodFilter, setMethodFilter] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['finance-payments', range],
        queryFn: () => financeApi.getPayments({ range })
    });

    const payments = data?.payments || [];

    const filtered = useMemo(() => {
        let result = payments;
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(p =>
                p.customerName?.toLowerCase().includes(q) ||
                p.archiveNumber?.toLowerCase().includes(q)
            );
        }
        if (methodFilter) {
            result = result.filter(p => p.method === methodFilter);
        }
        return result;
    }, [payments, search, methodFilter]);

    const totals = useMemo(() => {
        const cash = filtered.filter(p => p.method === 'cash').reduce((s, p) => s + (p.amount || 0), 0);
        const card = filtered.filter(p => p.method === 'credit_card').reduce((s, p) => s + (p.amount || 0), 0);
        const transfer = filtered.filter(p => p.method === 'transfer').reduce((s, p) => s + (p.amount || 0), 0);
        return { cash, card, transfer, total: cash + card + transfer };
    }, [filtered]);

    if (isLoading) return <SkeletonTable rows={8} columns={6} />;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-green-500/10 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{t('pages.finance.cash')}</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(totals.cash)}</p>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{t('pages.finance.creditCard').split(' ')[0]}</p>
                    <p className="text-lg font-bold text-blue-600">{formatCurrency(totals.card)}</p>
                </div>
                <div className="bg-purple-500/10 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{t('pages.finance.transfer').split('/')[0]}</p>
                    <p className="text-lg font-bold text-purple-600">{formatCurrency(totals.transfer)}</p>
                </div>
                <div className="bg-primary/10 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{t('pages.cashRegister.total')}</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(totals.total)}</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={t('pages.customers.search')}
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-background border border-input outline-none" />
                </div>
                <div className="flex gap-1">
                    {paymentMethods.map(m => (
                        <button key={m.value} onClick={() => setMethodFilter(m.value)}
                            className={cn('px-3 py-1.5 text-xs rounded-lg', methodFilter === m.value ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80')}>
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="text-left px-4 py-2.5 font-medium">Tarih</th>
                            <th className="text-left px-4 py-2.5 font-medium">Müşteri</th>
                            <th className="text-left px-4 py-2.5 font-medium">Arşiv No</th>
                            <th className="text-right px-4 py-2.5 font-medium">Tutar</th>
                            <th className="text-left px-4 py-2.5 font-medium">Yöntem</th>
                            <th className="text-left px-4 py-2.5 font-medium">Açıklama</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filtered.map((p, i) => (
                            <tr key={i} className="hover:bg-muted/30">
                                <td className="px-4 py-2.5">{formatDate(p.date)}</td>
                                <td className="px-4 py-2.5 font-medium">{p.customerName || '-'}</td>
                                <td className="px-4 py-2.5 text-muted-foreground">{p.archiveNumber || '-'}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-green-600">{formatCurrency(p.amount)}</td>
                                <td className="px-4 py-2.5">
                                    <span className={cn('px-2 py-0.5 rounded text-xs',
                                        p.method === 'cash' ? 'bg-green-500/10 text-green-600' :
                                            p.method === 'credit_card' ? 'bg-blue-500/10 text-blue-600' :
                                                'bg-purple-500/10 text-purple-600')}>
                                        {p.method === 'cash' ? 'Nakit' : p.method === 'credit_card' ? 'Kart' : 'Havale'}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 text-muted-foreground">{p.note || '-'}</td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Ödeme kaydı bulunamadı</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

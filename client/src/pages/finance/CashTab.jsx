import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '../../services/api';
import { formatDate, formatCurrency, cn } from '../../lib/utils';
import { Wallet, Banknote, CreditCard, ArrowUpDown, TrendingDown, FileText, Printer } from 'lucide-react';
import { SkeletonCard } from '../../components/Skeleton';
import notify from '../../lib/notify';

export default function CashTab() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [editBalance, setEditBalance] = useState(false);
    const [newBalance, setNewBalance] = useState(0);

    const today = new Date().toISOString().split('T')[0];

    const { data, isLoading } = useQuery({
        queryKey: ['finance-daily-cash', today],
        queryFn: () => financeApi.getDailyCash({ date: today })
    });

    const cash = data || {};

    const updateBalanceMutation = useMutation({
        mutationFn: (balance) => financeApi.setOpeningBalance({ date: today, openingBalance: balance }),
        onSuccess: () => {
            notify.success(t('common.success'));
            queryClient.invalidateQueries({ queryKey: ['finance-daily-cash'] });
            setEditBalance(false);
        },
        onError: () => notify.error(t('common.failed'))
    });

    if (isLoading) return <div className="max-w-2xl mx-auto"><SkeletonCard className="h-96" /></div>;

    const closingBalance = (cash.openingBalance || 0) + (cash.cashIncome || 0) + (cash.cardIncome || 0) + (cash.transferIncome || 0) - (cash.totalExpenses || 0);

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/50 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Wallet className="w-5 h-5" /> {t('pages.cashRegister.daily')} {t('pages.finance.cash')} — {formatDate(today)}
                    </h3>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                        <span className="font-medium">{t('pages.cashRegister.opening')} (Opsiyonel)</span>
                        {editBalance ? (
                            <div className="flex items-center gap-2">
                                <input type="number" value={newBalance} onChange={e => setNewBalance(Number(e.target.value))}
                                    className="w-32 px-2 py-1 text-right rounded border border-input bg-background outline-none" />
                                <button onClick={() => updateBalanceMutation.mutate(newBalance)}
                                    className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm">{t('common.save')}</button>
                                <button onClick={() => setEditBalance(false)} className="px-2 py-1 text-sm hover:bg-muted rounded">{t('common.cancel')}</button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-bold">{formatCurrency(cash.openingBalance || 0)}</span>
                                <button onClick={() => { setNewBalance(cash.openingBalance || 0); setEditBalance(true); }}
                                    className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80">Değiştir</button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Gelirler</h4>
                        <div className="flex justify-between px-4 py-2">
                            <span className="flex items-center gap-2"><Banknote className="w-4 h-4 text-green-600" /> Nakit Tahsilat</span>
                            <span className="text-green-600 font-medium">+{formatCurrency(cash.cashIncome || 0)}</span>
                        </div>
                        <div className="flex justify-between px-4 py-2">
                            <span className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-600" /> Kart Tahsilat</span>
                            <span className="text-blue-600 font-medium">+{formatCurrency(cash.cardIncome || 0)}</span>
                        </div>
                        <div className="flex justify-between px-4 py-2">
                            <span className="flex items-center gap-2"><ArrowUpDown className="w-4 h-4 text-purple-600" /> Havale Tahsilat</span>
                            <span className="text-purple-600 font-medium">+{formatCurrency(cash.transferIncome || 0)}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Giderler</h4>
                        <div className="flex justify-between px-4 py-2">
                            <span className="flex items-center gap-2"><TrendingDown className="w-4 h-4 text-destructive" /> Toplam Gider</span>
                            <span className="text-destructive font-medium">-{formatCurrency(cash.totalExpenses || 0)}</span>
                        </div>
                    </div>

                    <div className="border-t-2 border-border pt-4 flex justify-between items-center">
                        <span className="text-lg font-bold">Kasa Bakiye</span>
                        <span className={cn('text-2xl font-bold', closingBalance >= 0 ? 'text-green-600' : 'text-destructive')}>
                            {formatCurrency(closingBalance)}
                        </span>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button onClick={() => { setNewBalance(cash.openingBalance || 0); setEditBalance(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80">
                            Açılış Bakiyesini Değiştir
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80">
                            <FileText className="w-4 h-4" /> PDF İndir
                        </button>
                        <button onClick={() => window.print()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80">
                            <Printer className="w-4 h-4" /> Yazdır
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

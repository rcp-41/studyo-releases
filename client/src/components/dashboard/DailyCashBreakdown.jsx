import { useTranslation } from 'react-i18next';
import { Banknote, CreditCard, ArrowRightLeft } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

export default function DailyCashBreakdown({ summary }) {
    const { t } = useTranslation();
    const cash = summary?.finance?.dailyCash || 0;
    const card = summary?.finance?.dailyCard || 0;
    const transfer = summary?.finance?.dailyTransfer || 0;
    const total = cash + card + transfer;

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">{t('pages.cashRegister.daily')} {t('pages.finance.cash')}</h2>
            <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-500/5 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/10">
                            <Banknote className="w-5 h-5 text-green-500" />
                        </div>
                        <span className="text-sm font-medium">{t('pages.finance.cash')}</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(cash)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-500/5 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <CreditCard className="w-5 h-5 text-blue-500" />
                        </div>
                        <span className="text-sm font-medium">{t('pages.finance.creditCard')}</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(card)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-500/5 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                            <ArrowRightLeft className="w-5 h-5 text-purple-500" />
                        </div>
                        <span className="text-sm font-medium">{t('pages.finance.transfer')}</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(transfer)}</span>
                </div>
                <div className="flex items-center justify-between p-3 border-t border-border pt-4 mt-2">
                    <span className="font-semibold">{t('pages.cashRegister.total').toUpperCase()}</span>
                    <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
                </div>
            </div>
        </div>
    );
}

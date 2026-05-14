import { useTranslation } from 'react-i18next';
import { ShoppingCart, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function OnlineSalesCard({ filtered, dateRangeLabel }) {
    const { t } = useTranslation();

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{t('nav.onlineSales')}</h2>
                <Link
                    to="/wc-clients"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                    {t('common.all')} <ChevronRight className="w-4 h-4" />
                </Link>
            </div>
            <div className="flex flex-col items-center justify-center py-6">
                <div className="p-4 rounded-full bg-green-500/10 mb-3">
                    <ShoppingCart className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-3xl font-bold">{filtered?.onlineSalesCount ?? 0}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('common.create').toLowerCase()} ({dateRangeLabel})</p>
            </div>
        </div>
    );
}

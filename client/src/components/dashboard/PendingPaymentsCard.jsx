import { useTranslation } from 'react-i18next';
import { DollarSign, AlertCircle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PendingPaymentsCard({ summary }) {
    const { t } = useTranslation();
    const pendingList = summary?.pendingList || [];

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    {t('common.pending')} {t('common.payment')}
                    {(summary?.finance?.pendingPayments || 0) > 0 && (
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                    )}
                </h2>
                <Link
                    to="/archives?status=payment_pending"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                    {t('common.all')} <ChevronRight className="w-4 h-4" />
                </Link>
            </div>
            {pendingList.length > 0 ? (
                <div className="space-y-3">
                    {pendingList.slice(0, 5).map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div>
                                <p className="font-medium text-sm">{item.customerName}</p>
                                <p className="text-xs text-muted-foreground">{item.archiveNo}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-medium text-destructive text-sm">
                                    {item.remaining?.toLocaleString('tr-TR')} ₺
                                </p>
                                <p className="text-xs text-muted-foreground">{t('archives.remaining')}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>{t('common.pending')} {t('common.payment').toLowerCase()} {t('common.none').toLowerCase()}</p>
                </div>
            )}
        </div>
    );
}

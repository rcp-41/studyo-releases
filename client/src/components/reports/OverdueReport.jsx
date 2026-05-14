import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { financeApi } from '../../services/api';
import { formatCurrency } from '../../lib/utils';
import { SummaryCard, Loading, DataTable } from './shared';

export default function OverdueReport() {
    const { t } = useTranslation();

    const { data, isLoading } = useQuery({
        queryKey: ['report-overdue'],
        queryFn: () => financeApi.getOverduePayments()
    });

    const overdueList = data?.overdue || [];
    const totalOverdue = overdueList.reduce((s, o) => s + (o.remaining || 0), 0);

    const columns = [
        { key: 'customerName', label: t('pages.reports.customer') },
        { key: 'phone', label: t('pages.reports.phone') },
        { key: 'archiveNumber', label: t('pages.reports.archiveNumber') },
        { key: 'totalAmount', label: t('pages.reports.total') },
        { key: 'paidAmount', label: t('pages.reports.paidAmount') },
        { key: 'remaining', label: t('pages.reports.remaining') },
        { key: 'daysPassed', label: t('pages.reports.daysPassed') }
    ];

    if (isLoading) return <Loading />;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
                <SummaryCard label={t('pages.reports.totalOverdue')} value={formatCurrency(totalOverdue)} color="text-destructive" bg="bg-destructive/10" />
                <SummaryCard label={t('pages.reports.customerCount')} value={overdueList.length} color="text-orange-600" bg="bg-orange-500/10" />
                <SummaryCard
                    label={t('pages.reports.avgDelay')}
                    value={`${Math.round(overdueList.reduce((s, o) => s + (o.daysPassed || 0), 0) / (overdueList.length || 1))} ${t('pages.reports.days')}`}
                    color="text-yellow-600"
                    bg="bg-yellow-500/10"
                />
            </div>
            <DataTable data={overdueList} columns={columns} fileName="geciken_odemeler_raporu" />
        </div>
    );
}

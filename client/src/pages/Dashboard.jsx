import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlag } from '../lib/featureFlags';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../services/api';
import { Users, Camera, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

import BotStatusAlert from '../components/dashboard/BotStatusAlert';
import { SummaryCard } from '../components/dashboard/SummaryCards';
import DailyCashBreakdown from '../components/dashboard/DailyCashBreakdown';
import WeeklyAppointmentsChart from '../components/dashboard/WeeklyAppointmentsChart';
import PersonnelSection from '../components/dashboard/PersonnelSection';
import RevenueChart from '../components/dashboard/RevenueChart';
import ShootTypePie from '../components/dashboard/ShootTypePie';
import OnlineSalesCard from '../components/dashboard/OnlineSalesCard';
import PendingPaymentsCard from '../components/dashboard/PendingPaymentsCard';

const getDateRanges = (t) => [
    { key: 'today', label: t('pages.finance.today') },
    { key: 'week', label: t('pages.finance.week') },
    { key: 'month', label: t('pages.finance.month') },
    { key: 'year', label: t('common.year') || 'Bu Yıl' }
];

export default function Dashboard() {
    const { t } = useTranslation();
    const [dateRange, setDateRange] = useState('today');
    // Feature flag gate — 'advancedAnalytics' flag'i aktif edildiğinde gelişmiş analitik gösterilir
    const showAdvancedAnalytics = useFlag('advancedAnalytics', false); // eslint-disable-line no-unused-vars
    const DATE_RANGES = getDateRanges(t);

    const { data: summaryRaw, isLoading: summaryLoading } = useQuery({
        queryKey: ['dashboard', 'summary'],
        queryFn: async () => {
            const res = await dashboardApi.summary({});
            return res?.data || res || {};
        },
        retry: 1,
        staleTime: 60_000
    });

    const { data: filteredRaw, isLoading: filteredLoading } = useQuery({
        queryKey: ['dashboard', 'filtered', dateRange],
        queryFn: async () => {
            try {
                const res = await dashboardApi.filteredStats(dateRange);
                return res?.data || res || {};
            } catch (e) {
                console.warn('filteredStats error:', e);
                return {};
            }
        },
        retry: false,
        staleTime: 30_000
    });

    const summary = summaryRaw || {};
    const filtered = filteredRaw || {};
    const isLoading = summaryLoading || filteredLoading;

    const shootTypePieData = Object.entries(filtered?.shootTypeCounts || summary?.shootTypeCounts || {})
        .map(([type, count]) => ({ type, count }));
    const chartData = filtered?.chartData || [];
    const currentRangeLabel = DATE_RANGES.find(r => r.key === dateRange)?.label;

    return (
        <div className="space-y-6">
            {/* Header + Date Range Tabs */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{t('pages.dashboard.title')}</h1>
                    <p className="text-muted-foreground">{t('auth.studioTitle').toLowerCase()}</p>
                </div>
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                    {DATE_RANGES.map(range => (
                        <button
                            key={range.key}
                            onClick={() => setDateRange(range.key)}
                            className={cn(
                                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                                dateRange === range.key
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {range.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Row 1: Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <SummaryCard
                    title={t('pages.dashboard.todayAppointments').split('Bugünkü')[1] ? t('pages.dashboard.todayAppointments') : t('pages.finance.today')}
                    value={summary?.customers?.daily ?? 0}
                    subtitle={t('pages.finance.today')}
                    icon={Users}
                    color="blue"
                />
                <SummaryCard
                    title={t('pages.finance.week')}
                    value={summary?.customers?.weekly ?? 0}
                    subtitle={t('pages.finance.week').toLowerCase()}
                    icon={Users}
                    color="green"
                />
                <SummaryCard
                    title={`${currentRangeLabel || t('pages.finance.month')} — ${t('pages.customers.title')}`}
                    value={filtered?.customerCount ?? summary?.customers?.monthly ?? 0}
                    subtitle={`${t('pages.finance.revenue').toLowerCase()}: ${(filtered?.totalRevenue ?? 0).toLocaleString('tr-TR')} ₺`}
                    icon={Camera}
                    color="purple"
                />
                <SummaryCard
                    title={t('common.pending') + ' ' + t('common.update').toLowerCase()}
                    value={`${(summary?.finance?.pendingPayments ?? 0).toLocaleString('tr-TR')} ₺`}
                    subtitle={`${summary?.finance?.pendingPaymentsCount ?? 0} ${t('pages.archives.records').toLowerCase()}`}
                    icon={AlertCircle}
                    color="amber"
                />
            </div>

            {/* Row 2: Daily Cash + Revenue Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <DailyCashBreakdown summary={summary} />
                <RevenueChart
                    chartData={chartData}
                    dateRange={dateRange}
                    dateRangeLabel={currentRangeLabel}
                    isLoading={isLoading}
                />
            </div>

            {/* Row 3: Weekly Appointments + Personnel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <WeeklyAppointmentsChart summary={summary} />
                <PersonnelSection summary={summary} />
            </div>

            {/* Row 3.5: Bot Status Alert */}
            <BotStatusAlert />

            {/* Row 4: Shoot Types + Online Sales + Pending Payments */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ShootTypePie shootTypePieData={shootTypePieData} dateRangeLabel={currentRangeLabel} />
                <OnlineSalesCard filtered={filtered} dateRangeLabel={currentRangeLabel} />
                <PendingPaymentsCard summary={summary} />
            </div>
        </div>
    );
}

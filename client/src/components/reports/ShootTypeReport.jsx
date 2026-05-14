import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../../services/api';
import { formatCurrency } from '../../lib/utils';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loading, DataTable } from './shared';

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#3b82f6', '#f97316'];

export default function ShootTypeReport({ startDate, endDate }) {
    const { t } = useTranslation();

    const { data: raw, isLoading } = useQuery({
        queryKey: ['report-shootType', startDate, endDate],
        queryFn: async () => {
            const res = await statsApi.generateReport({ startDate, endDate, type: 'shootType', dateRange: 'custom' });
            return res?.data || res || {};
        }
    });

    const byShootType = raw?.byShootType || {};
    const totalCount = Object.values(byShootType).reduce((s, v) => s + (v.count || 0), 0) || 1;
    const dist = Object.entries(byShootType).map(([type, v]) => ({
        type,
        count: v.count || 0,
        revenue: formatCurrency(v.revenue || 0),
        percentage: ((v.count / totalCount) * 100).toFixed(1)
    }));

    const columns = [
        { key: 'type', label: t('pages.reports.shootType') },
        { key: 'count', label: t('pages.reports.count') },
        { key: 'revenue', label: t('pages.reports.revenue') },
        { key: 'percentage', label: t('pages.reports.percentage') }
    ];

    if (isLoading) return <Loading />;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-xl p-4">
                    <h3 className="text-sm font-semibold mb-4">{t('pages.reports.distribution')}</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={dist} cx="50%" cy="50%" innerRadius={60} outerRadius={110}
                                dataKey="count" nameKey="type" paddingAngle={2}>
                                {dist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                    {dist.map((d, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                <span className="text-sm font-medium">{d.type}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-bold">{d.count} {t('pages.reports.shoots')}</span>
                                <span className="text-xs text-muted-foreground ml-2">({d.percentage}%)</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <DataTable data={dist} columns={columns} fileName="cekim_turu_raporu" />
        </div>
    );
}

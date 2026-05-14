import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../../services/api';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loading, DataTable } from './shared';

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#3b82f6', '#f97316'];

export default function SourceReport({ startDate, endDate }) {
    const { t } = useTranslation();

    const { data: raw, isLoading } = useQuery({
        queryKey: ['report-source', startDate, endDate],
        queryFn: async () => {
            const res = await statsApi.generateReport({ startDate, endDate, type: 'source', dateRange: 'custom' });
            return res?.data || res || {};
        }
    });

    const records = raw?.records || [];
    const bySource = {};
    records.forEach(r => {
        const src = r.source || r.referralSource || t('pages.reports.unspecified');
        bySource[src] = (bySource[src] || 0) + 1;
    });
    const totalCount = records.length || 1;
    const sources = Object.entries(bySource).map(([source, count]) => ({
        source,
        count,
        percentage: ((count / totalCount) * 100).toFixed(1)
    }));

    const columns = [
        { key: 'source', label: t('pages.reports.source') },
        { key: 'count', label: t('pages.reports.customerCount') },
        { key: 'percentage', label: t('pages.reports.percentage') }
    ];

    if (isLoading) return <Loading />;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-xl p-4">
                    <h3 className="text-sm font-semibold mb-4">{t('pages.reports.sourceDistribution')}</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={sources} cx="50%" cy="50%" innerRadius={60} outerRadius={110}
                                dataKey="count" nameKey="source" paddingAngle={2}>
                                {sources.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                    {sources.map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                <span className="text-sm font-medium">{s.source}</span>
                            </div>
                            <span className="text-sm font-bold">{s.count} ({s.percentage}%)</span>
                        </div>
                    ))}
                </div>
            </div>
            <DataTable data={sources} columns={columns} fileName="musteri_kaynak_raporu" />
        </div>
    );
}

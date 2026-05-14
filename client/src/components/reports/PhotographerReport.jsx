import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../../services/api';
import { formatCurrency } from '../../lib/utils';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer, LabelList
} from 'recharts';
import { Loading, DataTable } from './shared';

const SHOOT_TYPE_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'];

export default function PhotographerReport({ startDate, endDate }) {
    const { t } = useTranslation();

    const { data: raw, isLoading } = useQuery({
        queryKey: ['report-photographer', startDate, endDate],
        queryFn: async () => {
            const res = await statsApi.generateReport({ startDate, endDate, type: 'photographer', dateRange: 'custom' });
            return res?.data || res || {};
        }
    });

    const records = raw?.records || [];

    const byPhotographer = {};
    const allShootTypes = new Set();
    records.forEach(r => {
        const name = r.photographerName || r.photographer || t('pages.reports.unspecified');
        const st = r.shootType || t('pages.reports.unspecified');
        allShootTypes.add(st);
        if (!byPhotographer[name]) byPhotographer[name] = { total: 0, revenue: 0, types: {} };
        byPhotographer[name].total++;
        byPhotographer[name].revenue += r.totalAmount || 0;
        if (!byPhotographer[name].types[st]) byPhotographer[name].types[st] = { count: 0, revenue: 0 };
        byPhotographer[name].types[st].count++;
        byPhotographer[name].types[st].revenue += r.totalAmount || 0;
    });

    const shootTypes = [...allShootTypes];
    const colorMap = {};
    shootTypes.forEach((st, i) => { colorMap[st] = SHOOT_TYPE_COLORS[i % SHOOT_TYPE_COLORS.length]; });

    const chartData = Object.entries(byPhotographer).map(([name, v]) => ({
        name,
        shootCount: v.total,
        revenue: v.revenue,
        _types: v.types
    }));

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        const types = payload[0]?.payload?._types || {};
        const totalCount = Object.values(types).reduce((s, t) => s + t.count, 0);
        const totalRev = Object.values(types).reduce((s, t) => s + t.revenue, 0);
        return (
            <div style={{ background: 'rgba(15, 15, 30, 0.60)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '12px 16px', fontSize: 12, minWidth: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13, color: 'var(--foreground)' }}>{label}</div>
                {Object.entries(types).map(([st, d]) => (
                    <div key={st} style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: colorMap[st], display: 'inline-block', flexShrink: 0 }} />
                            <span>{st}</span>
                        </span>
                        <span style={{ color: '#c4b5fd', whiteSpace: 'nowrap' }}>{d.count} {t('pages.reports.items')}</span>
                        <span style={{ fontWeight: 600, whiteSpace: 'nowrap', color: '#67e8f9' }}>₺{d.revenue.toLocaleString('tr-TR')}</span>
                    </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>{t('pages.reports.total')}</span>
                    <span style={{ display: 'flex', gap: 16 }}>
                        <span style={{ color: '#c4b5fd' }}>{totalCount} {t('pages.reports.items')}</span>
                        <span style={{ color: '#67e8f9' }}>₺{totalRev.toLocaleString('tr-TR')}</span>
                    </span>
                </div>
            </div>
        );
    };

    const tableData = Object.entries(byPhotographer).map(([name, v]) => {
        const row = {
            name,
            shootCount: v.total,
            revenue: v.revenue,
            avgRevenue: formatCurrency(v.total ? v.revenue / v.total : 0)
        };
        shootTypes.forEach(st => { row[`st_${st}`] = v.types[st]?.count || 0; });
        return row;
    });

    const columns = [
        { key: 'name', label: t('pages.reports.photographer') },
        ...shootTypes.map(st => ({ key: `st_${st}`, label: st })),
        { key: 'shootCount', label: t('pages.reports.total') },
        { key: 'revenue', label: t('pages.reports.revenue') },
        { key: 'avgRevenue', label: t('pages.reports.avgRevenue') }
    ];

    if (isLoading) return <Loading />;

    return (
        <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-4">{t('pages.reports.photographerPerformance')}</h3>
                <ResponsiveContainer width="100%" height={380}>
                    <BarChart data={chartData} barGap={8} barCategoryGap="20%" margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'currentColor' }} stroke="var(--muted-foreground)" interval={0} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#8b5cf6" />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#06b6d4" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="shootCount" name={t('pages.reports.shootCount')} fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                            <LabelList dataKey="shootCount" position="top" content={({ x, y, width, value }) => {
                                const text = `${value}`;
                                const tw = text.length * 8 + 12;
                                return (
                                    <g>
                                        <rect x={x + width / 2 - tw / 2} y={y - 24} width={tw} height={20} rx={5} fill="#1a1a2e" stroke="#8b5cf6" strokeWidth={1} />
                                        <text x={x + width / 2} y={y - 11} textAnchor="middle" fill="#ffffff" fontSize={12} fontWeight={700}>{text}</text>
                                    </g>
                                );
                            }} />
                        </Bar>
                        <Bar yAxisId="right" dataKey="revenue" name={t('pages.reports.revenue')} fill="#06b6d4" radius={[4, 4, 0, 0]}>
                            <LabelList dataKey="revenue" position="top" content={({ x, y, width, value }) => {
                                const text = `₺${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`;
                                const tw = text.length * 7.5 + 12;
                                return (
                                    <g>
                                        <rect x={x + width / 2 - tw / 2} y={y - 24} width={tw} height={20} rx={5} fill="#1a1a2e" stroke="#06b6d4" strokeWidth={1} />
                                        <text x={x + width / 2} y={y - 11} textAnchor="middle" fill="#ffffff" fontSize={11} fontWeight={700}>{text}</text>
                                    </g>
                                );
                            }} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <DataTable data={tableData} columns={columns} fileName="fotografci_raporu" />
        </div>
    );
}

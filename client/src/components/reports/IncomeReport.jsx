import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../../services/api';
import { formatCurrency } from '../../lib/utils';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer, LabelList
} from 'recharts';
import { SummaryCard, Loading, DataTable } from './shared';

export default function IncomeReport({ startDate, endDate }) {
    const { t } = useTranslation();

    const { data: raw, isLoading } = useQuery({
        queryKey: ['report-income', startDate, endDate],
        queryFn: async () => {
            const res = await statsApi.generateReport({ startDate, endDate, type: 'income', dateRange: 'custom' });
            return res?.data || res || {};
        }
    });

    const stats = raw?.summary || {};
    const chartData = (raw?.dailyBreakdown || []).map(d => ({
        date: d.date,
        cash: d.cash || 0,
        card: d.card || 0,
        transfer: d.transfer || 0,
        total: d.revenue || (d.cash || 0) + (d.card || 0) + (d.transfer || 0)
    }));

    const columns = [
        { key: 'date', label: t('pages.reports.date') },
        { key: 'cash', label: t('pages.reports.cash') },
        { key: 'card', label: t('pages.reports.card') },
        { key: 'transfer', label: t('pages.reports.transfer') },
        { key: 'total', label: t('pages.reports.total') }
    ];

    if (isLoading) return <Loading />;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-4 gap-3">
                <SummaryCard label={t('pages.reports.totalRevenue')} value={formatCurrency(stats.totalRevenue || 0)} color="text-green-600" bg="bg-green-500/10" />
                <SummaryCard label={t('pages.reports.cash')} value={formatCurrency(stats.totalCash || 0)} color="text-emerald-600" bg="bg-emerald-500/10" />
                <SummaryCard label={t('pages.reports.card')} value={formatCurrency(stats.totalCard || 0)} color="text-blue-600" bg="bg-blue-500/10" />
                <SummaryCard label={t('pages.reports.transfer')} value={formatCurrency(stats.totalTransfer || 0)} color="text-purple-600" bg="bg-purple-500/10" />
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-4">{t('pages.reports.incomeChart')}</h3>
                <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={chartData} margin={{ top: 30, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                        <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.2)' }} content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0]?.payload || {};
                            const total = (d.cash || 0) + (d.card || 0) + (d.transfer || 0);
                            return (
                                <div style={{ background: 'rgba(15, 15, 30, 0.60)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '12px 16px', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', minWidth: 160 }}>
                                    <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13, color: '#fff' }}>{label}</div>
                                    <div style={{ color: '#10b981', marginBottom: 3 }}>{t('pages.reports.cash')}: ₺{(d.cash || 0).toLocaleString('tr-TR')}</div>
                                    <div style={{ color: '#3b82f6', marginBottom: 3 }}>{t('pages.reports.card')}: ₺{(d.card || 0).toLocaleString('tr-TR')}</div>
                                    <div style={{ color: '#8b5cf6', marginBottom: 6 }}>{t('pages.reports.transfer')}: ₺{(d.transfer || 0).toLocaleString('tr-TR')}</div>
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 6, fontWeight: 700, color: '#fff' }}>{t('pages.reports.total')}: ₺{total.toLocaleString('tr-TR')}</div>
                                </div>
                            );
                        }} />
                        <Legend />
                        <Line type="monotone" dataKey="cash" name={t('pages.reports.cash')} stroke="#10b981" strokeWidth={2} />
                        <Line type="monotone" dataKey="card" name={t('pages.reports.card')} stroke="#3b82f6" strokeWidth={2} />
                        <Line type="monotone" dataKey="transfer" name={t('pages.reports.transfer')} stroke="#8b5cf6" strokeWidth={2} />
                        <Line type="monotone" dataKey="total" name={t('pages.reports.total')} stroke="transparent" dot={false} legendType="none">
                            <LabelList dataKey="total" position="top" content={({ x, y, value }) => {
                                if (!value) return null;
                                const text = value >= 1000 ? `₺${(value / 1000).toFixed(0)}k` : `₺${value}`;
                                const tw = text.length * 7 + 10;
                                return (
                                    <g>
                                        <rect x={x - tw / 2} y={y - 28} width={tw} height={18} rx={4} fill="rgba(15,15,30,0.75)" stroke="rgba(255,255,255,0.2)" strokeWidth={0.5} />
                                        <text x={x} y={y - 16} textAnchor="middle" fill="#ffffff" fontSize={10} fontWeight={600}>{text}</text>
                                    </g>
                                );
                            }} />
                        </Line>
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <DataTable data={chartData} columns={columns} fileName="gelir_raporu" />
        </div>
    );
}

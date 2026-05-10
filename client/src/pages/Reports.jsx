import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { financeApi, statsApi, archivesApi } from '../services/api';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import {
    BarChart3, TrendingUp, Camera, Users, Share2, AlertTriangle,
    Calendar, Download, FileText, Loader2
} from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList
} from 'recharts';
import { exportToExcel } from '../services/excelExport';
import { jsPDF } from 'jspdf';
import ExportColumnsModal from '../components/ExportColumnsModal';
import { SkeletonDashboard, SkeletonTable } from '../components/Skeleton';

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#3b82f6', '#f97316'];

function getTabs(t) {
    return [
        { key: 'income', label: t('pages.reports.income'), icon: TrendingUp },
        { key: 'shootType', label: t('pages.reports.shootType'), icon: Camera },
        { key: 'photographer', label: t('pages.reports.photographer'), icon: Users },
        { key: 'source', label: t('pages.reports.source'), icon: Share2 },
        { key: 'overdue', label: t('pages.reports.overdue'), icon: AlertTriangle }
    ];
}

// ===================== INCOME REPORT =====================
function IncomeReport({ startDate, endDate, t }) {
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
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3">
                <SummaryCard label={t('pages.reports.totalRevenue')} value={formatCurrency(stats.totalRevenue || 0)} color="text-green-600" bg="bg-green-500/10" />
                <SummaryCard label={t('pages.reports.cash')} value={formatCurrency(stats.totalCash || 0)} color="text-emerald-600" bg="bg-emerald-500/10" />
                <SummaryCard label={t('pages.reports.card')} value={formatCurrency(stats.totalCard || 0)} color="text-blue-600" bg="bg-blue-500/10" />
                <SummaryCard label={t('pages.reports.transfer')} value={formatCurrency(stats.totalTransfer || 0)} color="text-purple-600" bg="bg-purple-500/10" />
            </div>

            {/* Chart */}
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

            {/* Table */}
            <DataTable data={chartData} columns={columns} fileName="gelir_raporu" t={t} />
        </div>
    );
}

// ===================== SHOOT TYPE REPORT =====================
function ShootTypeReport({ startDate, endDate, t }) {
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
                {/* Pie chart */}
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

                {/* Stats */}
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

            <DataTable data={dist} columns={columns} fileName="cekim_turu_raporu" t={t} />
        </div>
    );
}

// ===================== PHOTOGRAPHER REPORT =====================
const SHOOT_TYPE_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'];

function PhotographerReport({ startDate, endDate, t }) {
    const { data: raw, isLoading } = useQuery({
        queryKey: ['report-photographer', startDate, endDate],
        queryFn: async () => {
            const res = await statsApi.generateReport({ startDate, endDate, type: 'photographer', dateRange: 'custom' });
            return res?.data || res || {};
        }
    });

    const records = raw?.records || [];

    // Group by photographer → then by shoot type
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

    // Chart data — two bars: shootCount + revenue
    const chartData = Object.entries(byPhotographer).map(([name, v]) => ({
        name,
        shootCount: v.total,
        revenue: v.revenue,
        _types: v.types
    }));

    // Custom tooltip: shows shoot type breakdown with count + revenue
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

    // Table data with shoot type columns
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

            <DataTable data={tableData} columns={columns} fileName="fotografci_raporu" t={t} />
        </div>
    );
}



// ===================== SOURCE REPORT =====================
function SourceReport({ startDate, endDate, t }) {
    const { data: raw, isLoading } = useQuery({
        queryKey: ['report-source', startDate, endDate],
        queryFn: async () => {
            const res = await statsApi.generateReport({ startDate, endDate, type: 'source', dateRange: 'custom' });
            return res?.data || res || {};
        }
    });

    // Derive source distribution from records
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
            <DataTable data={sources} columns={columns} fileName="musteri_kaynak_raporu" t={t} />
        </div>
    );
}

// ===================== OVERDUE REPORT =====================
function OverdueReport({ t }) {
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
                <SummaryCard label={t('pages.reports.avgDelay')} value={`${Math.round(overdueList.reduce((s, o) => s + (o.daysPassed || 0), 0) / (overdueList.length || 1))} ${t('pages.reports.days')}`}
                    color="text-yellow-600" bg="bg-yellow-500/10" />
            </div>
            <DataTable data={overdueList} columns={columns} fileName="geciken_odemeler_raporu" t={t} />
        </div>
    );
}

// ===================== SHARED COMPONENTS =====================
function SummaryCard({ label, value, color, bg }) {
    return (
        <div className={cn('rounded-lg p-3', bg)}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('text-lg font-bold', color)}>{value}</p>
        </div>
    );
}

function Loading() {
    return <SkeletonDashboard />;
}

function DataTable({ data, columns, fileName, t }) {
    const [showExport, setShowExport] = useState(false);

    return (
        <>
            <div className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-muted/50">
                    <span className="text-sm text-muted-foreground">{data.length} {t('pages.reports.records')}</span>
                    <div className="flex gap-2">
                        <button onClick={() => setShowExport(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                            <Download className="w-3.5 h-3.5" /> {t('pages.reports.excel')}
                        </button>
                        <button onClick={() => exportPdf(data, columns, fileName, t)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                            <FileText className="w-3.5 h-3.5" /> {t('pages.reports.pdf')}
                        </button>
                    </div>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                        <tr>
                            {columns.map(c => (
                                <th key={c.key} className="text-left px-4 py-2 font-medium">{c.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {data.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/20">
                                {columns.map(c => (
                                    <td key={c.key} className="px-4 py-2">{row[c.key] ?? '-'}</td>
                                ))}
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr><td colSpan={columns.length} className="text-center py-6 text-muted-foreground">{t('pages.reports.noData')}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showExport && (
                <ExportColumnsModal
                    allColumns={columns}
                    data={data}
                    fileName={fileName}
                    onClose={() => setShowExport(false)}
                />
            )}
        </>
    );
}

function exportPdf(data, columns, fileName, t) {
    const doc = new jsPDF();
    doc.setFont('helvetica');
    doc.setFontSize(14);
    doc.text(fileName.replace(/_/g, ' ').toUpperCase(), 14, 20);
    doc.setFontSize(9);
    doc.text(`${t('pages.reports.createdAt')}: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);

    // Simple table
    const startY = 35;
    const colWidth = (doc.internal.pageSize.width - 28) / columns.length;
    let y = startY;

    // Header
    doc.setFillColor(240, 240, 240);
    doc.rect(14, y - 4, doc.internal.pageSize.width - 28, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    columns.forEach((col, i) => {
        doc.text(col.label, 14 + i * colWidth, y);
    });

    // Rows
    doc.setFont('helvetica', 'normal');
    data.forEach((row) => {
        y += 7;
        if (y > doc.internal.pageSize.height - 20) {
            doc.addPage();
            y = 20;
        }
        columns.forEach((col, i) => {
            doc.text(String(row[col.key] ?? ''), 14 + i * colWidth, y);
        });
    });

    doc.save(`${fileName}.pdf`);
}

// ===================== MAIN COMPONENT =====================
export default function Reports() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('income');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const tabs = getTabs(t);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <BarChart3 className="w-7 h-7" /> {t('pages.reports.title')}
                </h1>
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                        className="px-2 py-1.5 text-sm rounded-lg bg-background border border-input outline-none" />
                    <span className="text-muted-foreground">—</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                        className="px-2 py-1.5 text-sm rounded-lg bg-background border border-input outline-none" />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                                activeTab === tab.key
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            )}>
                            <Icon className="w-4 h-4" /> {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            {activeTab === 'income' && <IncomeReport startDate={startDate} endDate={endDate} t={t} />}
            {activeTab === 'shootType' && <ShootTypeReport startDate={startDate} endDate={endDate} t={t} />}
            {activeTab === 'photographer' && <PhotographerReport startDate={startDate} endDate={endDate} t={t} />}
            {activeTab === 'source' && <SourceReport startDate={startDate} endDate={endDate} t={t} />}
            {activeTab === 'overdue' && <OverdueReport t={t} />}
        </div>
    );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlag } from '../lib/featureFlags';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, botApi } from '../services/api';
import { formatCurrency, formatDateTime, getStatusLabel, getShootTypeLabel } from '../lib/utils';
import {
    Users,
    Camera,
    Calendar,
    DollarSign,
    TrendingUp,
    Clock,
    AlertCircle,
    ChevronRight,
    Loader2,
    Banknote,
    CreditCard,
    ArrowRightLeft,
    UserX,
    ShoppingCart,
    Bot,
    MessageSquare,
    Phone
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
    Line,
    ComposedChart
} from 'recharts';
import { cn } from '../lib/utils';
import { SkeletonList } from '../components/Skeleton';

// Bot Status Alert Widget for Studio Admin Dashboard
function BotStatusAlert({ t }) {
    const { data: botStatus } = useQuery({
        queryKey: ['bot', 'status'],
        queryFn: async () => {
            try {
                const res = await botApi.getStatus();
                return res?.data || res || null;
            } catch { return null; }
        },
        retry: false,
        staleTime: 120_000
    });

    if (!botStatus) return null;

    const waEnabled = botStatus?.whatsapp?.enabled;
    const voiceEnabled = botStatus?.voice?.enabled;
    if (!waEnabled && !voiceEnabled) return null;

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Bot className="w-5 h-5 text-purple-500" />
                    AI Bot {t('pages.botConversations.title')}
                </h2>
                <Link
                    to="/bot-conversations"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                    {t('pages.botConversations.title')} <ChevronRight className="w-4 h-4" />
                </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
                {/* WhatsApp Channel */}
                <div className={`p-3 rounded-lg flex items-center gap-3 ${waEnabled ? 'bg-green-500/5' : 'bg-muted/50'}`}>
                    <div className={`p-2 rounded-lg ${waEnabled ? 'bg-green-500/10' : 'bg-muted'}`}>
                        <MessageSquare className={`w-5 h-5 ${waEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                        <p className="font-medium text-sm">WhatsApp</p>
                        <p className="text-xs text-muted-foreground">
                            {waEnabled ? '✅ ' + t('settingsPage.autoOn').split(' ')[2] : '❌ ' + t('settingsPage.autoOff').split(' ')[3]}
                            {botStatus?.whatsapp?.messageCount ? ` · ${botStatus.whatsapp.messageCount} ${t('pages.botConversations.messages')}` : ''}
                        </p>
                    </div>
                </div>
                {/* Voice Channel */}
                <div className={`p-3 rounded-lg flex items-center gap-3 ${voiceEnabled ? 'bg-purple-500/5' : 'bg-muted/50'}`}>
                    <div className={`p-2 rounded-lg ${voiceEnabled ? 'bg-purple-500/10' : 'bg-muted'}`}>
                        <Phone className={`w-5 h-5 ${voiceEnabled ? 'text-purple-500' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                        <p className="font-medium text-sm">{t('settingsPage.reminderHours').split(' ')[0]} Bot</p>
                        <p className="text-xs text-muted-foreground">
                            {voiceEnabled ? '✅ ' + t('settingsPage.autoOn').split(' ')[2] : '❌ ' + t('settingsPage.autoOff').split(' ')[3]}
                            {botStatus?.voice?.callCount ? ` · ${botStatus.voice.callCount} ${t('components.templateEditor.variables')}` : ''}
                        </p>
                    </div>
                </div>
            </div>
            {botStatus?.stats && (
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
                    <span>{t('pages.dashboard.todayAppointments').split('Bugün')[0]}: {botStatus.stats.todayMessages || 0} {t('pages.botConversations.messages')}</span>
                    <span>{botStatus.stats.todayAppointments || 0} {t('appointmentsPage.title').toLowerCase()} · {botStatus.stats.todayComplaints || 0} {t('common.warning').toLowerCase()}</span>
                </div>
            )}
        </div>
    );
}

// Summary Card Component
function SummaryCard({ title, value, subtitle, icon: Icon, trend, color }) {
    const colorClasses = {
        blue: 'bg-blue-500/10 text-blue-500',
        green: 'bg-green-500/10 text-green-500',
        purple: 'bg-purple-500/10 text-purple-500',
        amber: 'bg-amber-500/10 text-amber-500'
    };

    return (
        <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-muted-foreground">{title}</p>
                    <p className="text-3xl font-bold mt-1">{value}</p>
                    {subtitle && (
                        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                    )}
                </div>
                <div className={`p-3 rounded-lg ${colorClasses[color] || colorClasses.blue}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
            {trend && (
                <div className="flex items-center gap-1 mt-4 text-sm text-green-500">
                    <TrendingUp className="w-4 h-4" />
                    <span>{trend}</span>
                </div>
            )}
        </div>
    );
}

// Daily Cash Breakdown Card
function DailyCashBreakdown({ summary, t }) {
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

// Weekly Appointments Bar Chart
function WeeklyAppointmentsChart({ summary, t }) {
    const days = [t('appointmentsPage.month').substring(0, 3), 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const weeklyData = summary?.weeklyAppointments || days.map(d => ({ day: d, count: 0 }));

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">{t('appointmentsPage.week')} {t('appointmentsPage.title')}</h2>
            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                        <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} allowDecimals={false} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                            }}
                            formatter={(value) => [value, t('appointmentsPage.title')]}
                        />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// Personnel Section (leaves, staff status)
function PersonnelSection({ summary, t }) {
    const leaves = summary?.personnelLeaves || [];

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <UserX className="w-5 h-5 text-muted-foreground" />
                {t('users.leaveType')} {t('auth.staff')}
            </h2>
            {leaves.length > 0 ? (
                <div className="space-y-3">
                    {leaves.map((leave, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 text-sm font-medium">
                                    {leave.name?.charAt(0) || '?'}
                                </div>
                                <div>
                                    <p className="font-medium text-sm">{leave.name}</p>
                                    <p className="text-xs text-muted-foreground">{leave.reason || t('users.leaveType')}</p>
                                </div>
                            </div>
                            <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-600 font-medium">
                                {leave.day || t('pages.cashRegister.daily')}
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-center py-6 text-muted-foreground text-sm">{t('appointmentsPage.week')} {t('users.leaveType').toLowerCase()} {t('auth.staff')} {t('common.none').toLowerCase()}</p>
            )}
        </div>
    );
}

// Today's Appointments Component
function TodayAppointments({ appointments, isLoading, t }) {
    if (isLoading) {
        return <SkeletonList count={3} />;
    }

    if (!appointments?.length) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t('pages.cashRegister.daily')} {t('appointmentsPage.title')} {t('common.none').toLowerCase()}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {appointments.slice(0, 5).map((apt) => (
                <div
                    key={apt.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="font-medium">{apt.customer?.fullName}</p>
                            <p className="text-sm text-muted-foreground">
                                {formatDateTime(apt.appointmentDate)}
                            </p>
                        </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium status-${apt.status}`}>
                        {getStatusLabel(apt.status)}
                    </span>
                </div>
            ))}
        </div>
    );
}

// Pending Payments Component
function PendingPayments({ shoots, isLoading, t }) {
    if (isLoading) {
        return <SkeletonList count={3} />;
    }

    if (!shoots?.length) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t('common.pending')} {t('common.payment').toLowerCase()} {t('common.none').toLowerCase()}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {shoots.slice(0, 5).map((item) => (
                <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                    <div>
                        <p className="font-medium">{item.customerName || item.customer?.fullName || '-'}</p>
                        <p className="text-sm text-muted-foreground">{item.archiveNumber || item.shootCode || '-'}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-medium text-destructive">
                            {formatCurrency(item.remaining || item.remainingAmount || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">{t('archives.remaining')}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

// Chart colors
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// Date range tabs - will be initialized in component with t()
const getDateRanges = (t) => [
    { key: 'today', label: t('pages.finance.today') },
    { key: 'week', label: t('pages.finance.week') },
    { key: 'month', label: t('pages.finance.month') },
    { key: 'year', label: t('common.year') || 'Bu Yıl' }
];

// Safe date formatter — prevents "invalid time value" crash
const safeFormat = (dateVal, fallback = '-') => {
    if (!dateVal) return fallback;
    try {
        const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (isNaN(d.getTime())) return fallback;
        return d.toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    } catch { return fallback; }
};


export default function Dashboard() {
    const { t } = useTranslation();
    const [dateRange, setDateRange] = useState('today');
    // Feature flag gate örneği — 'advancedAnalytics' flag'i aktif edildiğinde
    // gelişmiş analitik bileşenlerini gösterir (şu an varsayılan: false)
    const showAdvancedAnalytics = useFlag('advancedAnalytics', false);
    const DATE_RANGES = getDateRanges(t);

    // Always-fresh summary (daily cash, weekly appointments, pending payments)
    const { data: summaryRaw, isLoading: summaryLoading } = useQuery({
        queryKey: ['dashboard', 'summary'],
        queryFn: async () => {
            const res = await dashboardApi.summary({});
            return res?.data || res || {};
        },
        retry: 1,
        staleTime: 60_000
    });

    // Date-filtered stats for the selected period
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

    // Shoot types from filtered stats (respects date filter)
    const shootTypePieData = Object.entries(filtered?.shootTypeCounts || summary?.shootTypeCounts || {}).map(([type, count]) => ({ type, count }));

    // Revenue chart from filtered stats — dual axis
    const chartData = filtered?.chartData || [];

    // todayAppointments data is already included in the summary response
    // (summary.customers.daily and summary.appointments.today)
    // No need for a separate API call.

    const isLoading = summaryLoading || filteredLoading;


    return (
        <div className="space-y-6">
            {/* Page Header with Date Range Tabs */}
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

            {/* Summary Cards Row 1: Customer Counts */}
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
                    title={`${DATE_RANGES.find(r => r.key === dateRange)?.label || t('pages.finance.month')} — ${t('pages.customers.title')}`}
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
                {/* Daily Cash Breakdown */}
                <DailyCashBreakdown summary={summary} t={t} />

                {/* Revenue Chart (larger) — from filteredStats chartData */}
                <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">{t('pages.finance.revenue')} {t('components.templateEditor.variables')}</h2>
                        <span className="text-sm text-muted-foreground">
                            {DATE_RANGES.find(r => r.key === dateRange)?.label}
                        </span>
                    </div>
                    <div className="h-64">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis
                                        dataKey="date"
                                        stroke="hsl(var(--muted-foreground))"
                                        tick={{ fontSize: 12 }}
                                        tickFormatter={(value) => dateRange === 'today' ? value : (value.split('-')[2] || value)}
                                    />
                                    <YAxis
                                        yAxisId="revenue"
                                        orientation="left"
                                        stroke="#10b981"
                                        tick={{ fontSize: 11 }}
                                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                                    />
                                    <YAxis
                                        yAxisId="customers"
                                        orientation="right"
                                        stroke="#3b82f6"
                                        tick={{ fontSize: 11 }}
                                        allowDecimals={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--card))',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '8px'
                                        }}
                                        formatter={(value, name) => [
                                            name === 'revenue' ? `${value.toLocaleString('tr-TR')} ₺` : value,
                                            name === 'revenue' ? t('pages.finance.revenue') : t('pages.customers.title')
                                        ]}
                                    />
                                    <Area
                                        yAxisId="revenue"
                                        type="monotone"
                                        dataKey="revenue"
                                        stroke="#10b981"
                                        fill="rgba(16, 185, 129, 0.15)"
                                        name="revenue"
                                    />
                                    <Line
                                        yAxisId="customers"
                                        type="monotone"
                                        dataKey="customers"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        dot={{ r: 3, fill: '#3b82f6' }}
                                        name="customers"
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : t('common.noData')}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Row 3: Weekly Appointments + Personnel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <WeeklyAppointmentsChart summary={summary} t={t} />
                <PersonnelSection summary={summary} t={t} />
            </div>

            {/* Row 3.5: Bot Status Alert (only shown if bot is configured) */}
            <BotStatusAlert t={t} />

            {/* Row 4: Shoot Types + Today's Schedule + Pending */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Shoot Types Pie Chart */}
                <div className="bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">{t('shoots.shootTypes')}</h2>
                        <span className="text-sm text-muted-foreground">{DATE_RANGES.find(r => r.key === dateRange)?.label}</span>
                    </div>
                    <div className="h-52 flex items-center justify-center">
                        {shootTypePieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={shootTypePieData}
                                        dataKey="count"
                                        nameKey="type"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={70}
                                        label={({ type, count }) => `${type}: ${count}`}
                                    >
                                        {shootTypePieData.map((_, index) => (
                                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value, name) => [value, name]} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-muted-foreground">{t('common.noData')}</div>
                        )}
                    </div>
                </div>

                {/* Online Satışlar */}
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
                        <p className="text-sm text-muted-foreground mt-1">{t('common.create').toLowerCase()} ({DATE_RANGES.find(r => r.key === dateRange)?.label})</p>
                    </div>
                </div>

                {/* Pending Payments — from summary.pendingList */}
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
                    {(summary?.pendingList || []).length > 0 ? (
                        <div className="space-y-3">
                            {(summary.pendingList || []).slice(0, 5).map(item => (
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
            </div>
        </div>
    );
}

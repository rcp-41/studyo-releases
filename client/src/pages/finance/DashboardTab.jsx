import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { financeApi } from '../../services/api';
import { formatDate, formatCurrency, cn } from '../../lib/utils';
import {
    DollarSign, Wallet, TrendingDown, CreditCard, Banknote, ArrowUpDown,
    TrendingUp, Percent
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
    PieChart, Pie, Cell, ReferenceLine
} from 'recharts';
import { SkeletonDashboard } from '../../components/Skeleton';

const EXPENSE_COLORS = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#06b6d4', '#22c55e', '#ec4899', '#3b82f6', '#6b7280'];

function getCategoryLabel(cat, t) {
    const expenseCategories = [
        { value: 'rent', label: t('pages.finance.rent') },
        { value: 'utilities', label: t('pages.finance.utilities') },
        { value: 'apps', label: t('pages.finance.apps') },
        { value: 'salary', label: t('pages.finance.salary') },
        { value: 'equipment', label: t('pages.finance.equipment') },
        { value: 'material', label: t('pages.finance.material') },
        { value: 'transport', label: t('pages.finance.transport') },
        { value: 'ads', label: t('pages.finance.ads') },
        { value: 'other', label: t('pages.finance.other') }
    ];
    return expenseCategories.find(c => c.value === cat)?.label || cat;
}

export default function DashboardTab({ range }) {
    const { t } = useTranslation();
    const today = new Date().toISOString().split('T')[0];
    const { data: payData, isLoading: payLoading } = useQuery({
        queryKey: ['finance-payments', range],
        queryFn: () => financeApi.getPayments({ range })
    });
    const { data: expData, isLoading: expLoading } = useQuery({
        queryKey: ['finance-expenses', range],
        queryFn: () => financeApi.getExpenses({ range })
    });
    const { data: cashData, isLoading: cashLoading } = useQuery({
        queryKey: ['finance-daily-cash', today],
        queryFn: () => financeApi.getDailyCash({ date: today })
    });

    if (payLoading || expLoading || cashLoading) return <SkeletonDashboard />;

    const cash = cashData || {};
    const kasaBalance = (cash.openingBalance || 0) + (cash.cashIncome || 0) + (cash.cardIncome || 0) + (cash.transferIncome || 0) - (cash.totalExpenses || 0);

    const payments = payData?.payments || [];
    const expenses = expData?.expenses || [];

    const { totalIncome, cashIncome, cardIncome, transferIncome } = useMemo(() => {
        let total = 0, cashAmt = 0, cardAmt = 0, transferAmt = 0;
        for (const p of payments) {
            const amount = p.amount || 0;
            total += amount;
            if (p.method === 'cash') cashAmt += amount;
            else if (p.method === 'credit_card') cardAmt += amount;
            else if (p.method === 'transfer') transferAmt += amount;
        }
        return { totalIncome: total, cashIncome: cashAmt, cardIncome: cardAmt, transferIncome: transferAmt };
    }, [payments]);

    const totalExpense = useMemo(() => expenses.reduce((s, e) => s + (e.amount || 0), 0), [expenses]);
    const profit = totalIncome - totalExpense;
    const margin = totalIncome > 0 ? ((profit / totalIncome) * 100).toFixed(1) : '0.0';

    const expensePieData = useMemo(() => {
        const expByCat = {};
        expenses.forEach(e => {
            const cat = getCategoryLabel(e.category, t);
            expByCat[cat] = (expByCat[cat] || 0) + (e.amount || 0);
        });
        return Object.entries(expByCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [expenses, t]);

    const barData = useMemo(() => [
        { name: t('pages.finance.revenue'), value: totalIncome, fill: '#22c55e' },
        { name: t('pages.finance.expense'), value: -totalExpense, fill: '#ef4444' },
        { name: t('pages.finance.netIncome'), value: profit, fill: profit >= 0 ? '#22c55e' : '#ef4444' }
    ], [totalIncome, totalExpense, profit, t]);

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 rounded-lg bg-green-500/10"><TrendingUp className="w-5 h-5 text-green-500" /></div>
                        <span className="text-sm text-muted-foreground">{t('pages.finance.totalRevenue')}</span>
                    </div>
                    <p className="text-2xl font-bold text-green-500">{formatCurrency(totalIncome)}</p>
                    <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                        <span>{t('pages.finance.cash')}: {formatCurrency(cashIncome)}</span>
                        <span>{t('pages.finance.creditCard').split(' ')[0]}: {formatCurrency(cardIncome)}</span>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 rounded-lg bg-red-500/10"><TrendingDown className="w-5 h-5 text-red-500" /></div>
                        <span className="text-sm text-muted-foreground">{t('pages.finance.totalExpenses')}</span>
                    </div>
                    <p className="text-2xl font-bold text-red-500">{formatCurrency(totalExpense)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{t('pages.finance.totalExpenses')}: {expenses.length}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className={cn('p-2.5 rounded-lg', profit >= 0 ? 'bg-blue-500/10' : 'bg-orange-500/10')}>
                            <DollarSign className={cn('w-5 h-5', profit >= 0 ? 'text-blue-500' : 'text-orange-500')} />
                        </div>
                        <span className="text-sm text-muted-foreground">{t('pages.finance.netIncome')}</span>
                    </div>
                    <p className={cn('text-2xl font-bold', profit >= 0 ? 'text-blue-500' : 'text-orange-500')}>
                        {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">{profit >= 0 ? t('pages.finance.revenue') : 'Zarar'}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 rounded-lg bg-purple-500/10"><Percent className="w-5 h-5 text-purple-500" /></div>
                        <span className="text-sm text-muted-foreground">Profit Margin</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-500">%{margin}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Revenue-Expense Ratio</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className={cn('p-2.5 rounded-lg', kasaBalance >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
                            <Wallet className={cn('w-5 h-5', kasaBalance >= 0 ? 'text-emerald-500' : 'text-red-500')} />
                        </div>
                        <span className="text-sm text-muted-foreground">Cash Balance</span>
                    </div>
                    <p className={cn('text-2xl font-bold', kasaBalance >= 0 ? 'text-emerald-500' : 'text-red-500')}>{formatCurrency(kasaBalance)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Daily Cash ({formatDate(today)})</p>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold mb-4">Revenue / Expense / Profit</h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={barData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'currentColor' }} stroke="var(--muted-foreground)" />
                            <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={v => { const abs = Math.abs(v); return abs >= 1000 ? `${(abs / 1000).toFixed(0)}k` : abs; }} />
                            <Tooltip cursor={{ fill: 'transparent' }} content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0]?.payload;
                                return (
                                    <div style={{ background: 'rgba(15,15,30,0.60)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                                        <div style={{ fontWeight: 700, color: '#fff', marginBottom: 4 }}>{d.name}</div>
                                        <div style={{ color: d.fill, fontWeight: 600, fontSize: 14 }}>₺{d.value.toLocaleString('tr-TR')}</div>
                                    </div>
                                );
                            }} />
                            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold mb-4">Expense Distribution</h3>
                    {expensePieData.length > 0 ? (
                        <div className="flex items-center">
                            <ResponsiveContainer width="60%" height={280}>
                                <PieChart>
                                    <Pie data={expensePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50}>
                                        {expensePieData.map((_, i) => <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const d = payload[0];
                                        return (
                                            <div style={{ background: 'rgba(15,15,30,0.60)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                                                <div style={{ fontWeight: 700, color: '#fff', marginBottom: 4 }}>{d.name}</div>
                                                <div style={{ color: d.payload.fill, fontWeight: 600 }}>₺{d.value.toLocaleString('tr-TR')}</div>
                                            </div>
                                        );
                                    }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex-1 space-y-2">
                                {expensePieData.map((d, i) => (
                                    <div key={d.name} className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                                            <span className="truncate">{d.name}</span>
                                        </span>
                                        <span className="font-medium ml-2 whitespace-nowrap">{formatCurrency(d.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-[280px] text-muted-foreground">No expense data</div>
                    )}
                </div>
            </div>

            {/* Payment method breakdown */}
            <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4">Payment Method Distribution</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 rounded-lg bg-green-500/10">
                        <Banknote className="w-6 h-6 text-green-500 mx-auto mb-2" />
                        <p className="text-lg font-bold text-green-500">{formatCurrency(cashIncome)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Cash</p>
                        <p className="text-xs text-muted-foreground">{totalIncome > 0 ? ((cashIncome / totalIncome) * 100).toFixed(1) : 0}%</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-blue-500/10">
                        <CreditCard className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                        <p className="text-lg font-bold text-blue-500">{formatCurrency(cardIncome)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Credit Card</p>
                        <p className="text-xs text-muted-foreground">{totalIncome > 0 ? ((cardIncome / totalIncome) * 100).toFixed(1) : 0}%</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-purple-500/10">
                        <ArrowUpDown className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                        <p className="text-lg font-bold text-purple-500">{formatCurrency(transferIncome)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Transfer</p>
                        <p className="text-xs text-muted-foreground">{totalIncome > 0 ? ((transferIncome / totalIncome) * 100).toFixed(1) : 0}%</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

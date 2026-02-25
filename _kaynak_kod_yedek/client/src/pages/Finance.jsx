import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi, whatsappApi } from '../services/api';
import { formatDate, formatCurrency, cn } from '../lib/utils';
import {
    DollarSign, Wallet, TrendingDown, AlertTriangle, Search, Plus,
    Calendar, CreditCard, Banknote, ArrowUpDown, X, Loader2,
    CheckSquare, Square, MessageCircle, Printer, FileText,
    LayoutDashboard, TrendingUp, Percent
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';

const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'payments', label: 'Gelirler', icon: DollarSign },
    { key: 'cash', label: 'Kasa', icon: Wallet },
    { key: 'expenses', label: 'Giderler', icon: TrendingDown },
    { key: 'overdue', label: 'Geciken Ödemeler', icon: AlertTriangle }
];

const dateRanges = [
    { key: 'today', label: 'Bugün' },
    { key: 'week', label: 'Bu Hafta' },
    { key: 'month', label: 'Bu Ay' }
];

const paymentMethods = [
    { value: '', label: 'Tümü' },
    { value: 'cash', label: 'Nakit' },
    { value: 'credit_card', label: 'Kredi Kartı' },
    { value: 'transfer', label: 'Havale/EFT' }
];

const expenseCategories = [
    { value: 'rent', label: 'Kira' },
    { value: 'utilities', label: 'Faturalar' },
    { value: 'apps', label: 'Uygulamalar' },
    { value: 'salary', label: 'Personel Maaşı' },
    { value: 'equipment', label: 'Ekipman' },
    { value: 'material', label: 'Malzeme' },
    { value: 'transport', label: 'Ulaşım' },
    { value: 'ads', label: 'Reklam' },
    { value: 'other', label: 'Diğer' }
];

const utilitySubCategories = [
    { value: 'electricity', label: 'Elektrik' },
    { value: 'water', label: 'Su' },
    { value: 'gas', label: 'Doğalgaz' },
    { value: 'internet', label: 'İnternet' }
];

function getCategoryLabel(cat) {
    return expenseCategories.find(c => c.value === cat)?.label || cat;
}

function getSubCategoryLabel(sub) {
    return utilitySubCategories.find(s => s.value === sub)?.label || sub;
}

// ===================== DASHBOARD TAB =====================
const EXPENSE_COLORS = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#06b6d4', '#22c55e', '#ec4899', '#3b82f6', '#6b7280'];

function DashboardTab({ range }) {
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

    if (payLoading || expLoading || cashLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

    const cash = cashData || {};
    const kasaBalance = (cash.openingBalance || 0) + (cash.cashIncome || 0) + (cash.cardIncome || 0) + (cash.transferIncome || 0) - (cash.totalExpenses || 0);

    const payments = payData?.payments || [];
    const expenses = expData?.expenses || [];

    const totalIncome = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const cashIncome = payments.filter(p => p.method === 'cash').reduce((s, p) => s + (p.amount || 0), 0);
    const cardIncome = payments.filter(p => p.method === 'credit_card').reduce((s, p) => s + (p.amount || 0), 0);
    const transferIncome = payments.filter(p => p.method === 'transfer').reduce((s, p) => s + (p.amount || 0), 0);
    const totalExpense = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const profit = totalIncome - totalExpense;
    const margin = totalIncome > 0 ? ((profit / totalIncome) * 100).toFixed(1) : '0.0';

    // Expense by category
    const expByCat = {};
    expenses.forEach(e => {
        const cat = getCategoryLabel(e.category);
        expByCat[cat] = (expByCat[cat] || 0) + (e.amount || 0);
    });
    const expensePieData = Object.entries(expByCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Income vs Expense bar
    const comparisonData = [
        { name: 'Nakit', income: cashIncome, expense: 0 },
        { name: 'Kart', income: cardIncome, expense: 0 },
        { name: 'Havale', income: transferIncome, expense: 0 }
    ];
    // Distribute expenses by methods (we don't have method on expenses, so show total)
    const barData = [
        { name: 'Gelir', value: totalIncome, fill: '#22c55e' },
        { name: 'Gider', value: totalExpense, fill: '#ef4444' },
        { name: 'Kâr/Zarar', value: profit, fill: profit >= 0 ? '#3b82f6' : '#f97316' }
    ];

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 rounded-lg bg-green-500/10"><TrendingUp className="w-5 h-5 text-green-500" /></div>
                        <span className="text-sm text-muted-foreground">Toplam Gelir</span>
                    </div>
                    <p className="text-2xl font-bold text-green-500">{formatCurrency(totalIncome)}</p>
                    <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                        <span>Nakit: {formatCurrency(cashIncome)}</span>
                        <span>Kart: {formatCurrency(cardIncome)}</span>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 rounded-lg bg-red-500/10"><TrendingDown className="w-5 h-5 text-red-500" /></div>
                        <span className="text-sm text-muted-foreground">Toplam Gider</span>
                    </div>
                    <p className="text-2xl font-bold text-red-500">{formatCurrency(totalExpense)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{expenses.length} gider kaydı</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className={cn('p-2.5 rounded-lg', profit >= 0 ? 'bg-blue-500/10' : 'bg-orange-500/10')}>
                            <DollarSign className={cn('w-5 h-5', profit >= 0 ? 'text-blue-500' : 'text-orange-500')} />
                        </div>
                        <span className="text-sm text-muted-foreground">Net Kâr / Zarar</span>
                    </div>
                    <p className={cn('text-2xl font-bold', profit >= 0 ? 'text-blue-500' : 'text-orange-500')}>
                        {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">{profit >= 0 ? 'Kâr' : 'Zarar'}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 rounded-lg bg-purple-500/10"><Percent className="w-5 h-5 text-purple-500" /></div>
                        <span className="text-sm text-muted-foreground">Kâr Marjı</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-500">%{margin}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Gelir-gider oranı</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className={cn('p-2.5 rounded-lg', kasaBalance >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
                            <Wallet className={cn('w-5 h-5', kasaBalance >= 0 ? 'text-emerald-500' : 'text-red-500')} />
                        </div>
                        <span className="text-sm text-muted-foreground">Kasa Bakiye</span>
                    </div>
                    <p className={cn('text-2xl font-bold', kasaBalance >= 0 ? 'text-emerald-500' : 'text-red-500')}>{formatCurrency(kasaBalance)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Günlük kasa ({formatDate(today)})</p>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Income vs Expense Bar */}
                <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold mb-4">Gelir / Gider / Kâr</h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={barData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'currentColor' }} stroke="var(--muted-foreground)" />
                            <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
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
                            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Expense Breakdown Pie */}
                <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold mb-4">Gider Dağılımı</h3>
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
                        <div className="flex items-center justify-center h-[280px] text-muted-foreground">Gider verisi yok</div>
                    )}
                </div>
            </div>

            {/* Payment method breakdown */}
            <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4">Ödeme Yöntemi Dağılımı</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 rounded-lg bg-green-500/10">
                        <Banknote className="w-6 h-6 text-green-500 mx-auto mb-2" />
                        <p className="text-lg font-bold text-green-500">{formatCurrency(cashIncome)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Nakit</p>
                        <p className="text-xs text-muted-foreground">{totalIncome > 0 ? ((cashIncome / totalIncome) * 100).toFixed(1) : 0}%</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-blue-500/10">
                        <CreditCard className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                        <p className="text-lg font-bold text-blue-500">{formatCurrency(cardIncome)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Kredi Kartı</p>
                        <p className="text-xs text-muted-foreground">{totalIncome > 0 ? ((cardIncome / totalIncome) * 100).toFixed(1) : 0}%</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-purple-500/10">
                        <ArrowUpDown className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                        <p className="text-lg font-bold text-purple-500">{formatCurrency(transferIncome)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Havale / EFT</p>
                        <p className="text-xs text-muted-foreground">{totalIncome > 0 ? ((transferIncome / totalIncome) * 100).toFixed(1) : 0}%</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ===================== PAYMENTS TAB =====================
function PaymentsTab({ range }) {
    const [search, setSearch] = useState('');
    const [methodFilter, setMethodFilter] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['finance-payments', range],
        queryFn: () => financeApi.getPayments({ range })
    });

    const payments = data?.payments || [];

    const filtered = useMemo(() => {
        let result = payments;
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(p =>
                p.customerName?.toLowerCase().includes(q) ||
                p.archiveNumber?.toLowerCase().includes(q)
            );
        }
        if (methodFilter) {
            result = result.filter(p => p.method === methodFilter);
        }
        return result;
    }, [payments, search, methodFilter]);

    const totals = useMemo(() => {
        const cash = filtered.filter(p => p.method === 'cash').reduce((s, p) => s + (p.amount || 0), 0);
        const card = filtered.filter(p => p.method === 'credit_card').reduce((s, p) => s + (p.amount || 0), 0);
        const transfer = filtered.filter(p => p.method === 'transfer').reduce((s, p) => s + (p.amount || 0), 0);
        return { cash, card, transfer, total: cash + card + transfer };
    }, [filtered]);

    if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-green-500/10 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Nakit</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(totals.cash)}</p>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Kart</p>
                    <p className="text-lg font-bold text-blue-600">{formatCurrency(totals.card)}</p>
                </div>
                <div className="bg-purple-500/10 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Havale</p>
                    <p className="text-lg font-bold text-purple-600">{formatCurrency(totals.transfer)}</p>
                </div>
                <div className="bg-primary/10 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Toplam</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(totals.total)}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Müşteri veya arşiv no ara..."
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-background border border-input outline-none" />
                </div>
                <div className="flex gap-1">
                    {paymentMethods.map(m => (
                        <button key={m.value} onClick={() => setMethodFilter(m.value)}
                            className={cn('px-3 py-1.5 text-xs rounded-lg', methodFilter === m.value ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80')}>
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="text-left px-4 py-2.5 font-medium">Tarih</th>
                            <th className="text-left px-4 py-2.5 font-medium">Müşteri</th>
                            <th className="text-left px-4 py-2.5 font-medium">Arşiv No</th>
                            <th className="text-right px-4 py-2.5 font-medium">Tutar</th>
                            <th className="text-left px-4 py-2.5 font-medium">Yöntem</th>
                            <th className="text-left px-4 py-2.5 font-medium">Açıklama</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filtered.map((p, i) => (
                            <tr key={i} className="hover:bg-muted/30">
                                <td className="px-4 py-2.5">{formatDate(p.date)}</td>
                                <td className="px-4 py-2.5 font-medium">{p.customerName || '-'}</td>
                                <td className="px-4 py-2.5 text-muted-foreground">{p.archiveNumber || '-'}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-green-600">{formatCurrency(p.amount)}</td>
                                <td className="px-4 py-2.5">
                                    <span className={cn('px-2 py-0.5 rounded text-xs',
                                        p.method === 'cash' ? 'bg-green-500/10 text-green-600' :
                                            p.method === 'credit_card' ? 'bg-blue-500/10 text-blue-600' :
                                                'bg-purple-500/10 text-purple-600')}>
                                        {p.method === 'cash' ? 'Nakit' : p.method === 'credit_card' ? 'Kart' : 'Havale'}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 text-muted-foreground">{p.note || '-'}</td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Ödeme kaydı bulunamadı</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ===================== CASH TAB =====================
function CashTab({ range }) {
    const queryClient = useQueryClient();
    const [editBalance, setEditBalance] = useState(false);
    const [newBalance, setNewBalance] = useState(0);

    const today = new Date().toISOString().split('T')[0];

    const { data, isLoading } = useQuery({
        queryKey: ['finance-daily-cash', today],
        queryFn: () => financeApi.getDailyCash({ date: today })
    });

    const cash = data || {};

    const updateBalanceMutation = useMutation({
        mutationFn: (balance) => financeApi.setOpeningBalance({ date: today, openingBalance: balance }),
        onSuccess: () => {
            toast.success('Açılış bakiyesi güncellendi');
            queryClient.invalidateQueries({ queryKey: ['finance-daily-cash'] });
            setEditBalance(false);
        },
        onError: () => toast.error('Güncelleme başarısız')
    });

    if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

    const closingBalance = (cash.openingBalance || 0) + (cash.cashIncome || 0) + (cash.cardIncome || 0) + (cash.transferIncome || 0) - (cash.totalExpenses || 0);

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Header */}
                <div className="bg-muted/50 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Wallet className="w-5 h-5" /> Günlük Kasa — {formatDate(today)}
                    </h3>
                </div>

                <div className="p-6 space-y-4">
                    {/* Opening Balance */}
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                        <span className="font-medium">Açılış Bakiyesi (manuel)</span>
                        {editBalance ? (
                            <div className="flex items-center gap-2">
                                <input type="number" value={newBalance} onChange={e => setNewBalance(Number(e.target.value))}
                                    className="w-32 px-2 py-1 text-right rounded border border-input bg-background outline-none" />
                                <button onClick={() => updateBalanceMutation.mutate(newBalance)}
                                    className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm">Kaydet</button>
                                <button onClick={() => setEditBalance(false)} className="px-2 py-1 text-sm hover:bg-muted rounded">İptal</button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-bold">{formatCurrency(cash.openingBalance || 0)}</span>
                                <button onClick={() => { setNewBalance(cash.openingBalance || 0); setEditBalance(true); }}
                                    className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80">Değiştir</button>
                            </div>
                        )}
                    </div>

                    {/* Incomes */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Gelirler</h4>
                        <div className="flex justify-between px-4 py-2">
                            <span className="flex items-center gap-2"><Banknote className="w-4 h-4 text-green-600" /> Nakit Tahsilat</span>
                            <span className="text-green-600 font-medium">+{formatCurrency(cash.cashIncome || 0)}</span>
                        </div>
                        <div className="flex justify-between px-4 py-2">
                            <span className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-600" /> Kart Tahsilat</span>
                            <span className="text-blue-600 font-medium">+{formatCurrency(cash.cardIncome || 0)}</span>
                        </div>
                        <div className="flex justify-between px-4 py-2">
                            <span className="flex items-center gap-2"><ArrowUpDown className="w-4 h-4 text-purple-600" /> Havale Tahsilat</span>
                            <span className="text-purple-600 font-medium">+{formatCurrency(cash.transferIncome || 0)}</span>
                        </div>
                    </div>

                    {/* Expenses */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Giderler</h4>
                        <div className="flex justify-between px-4 py-2">
                            <span className="flex items-center gap-2"><TrendingDown className="w-4 h-4 text-destructive" /> Toplam Gider</span>
                            <span className="text-destructive font-medium">-{formatCurrency(cash.totalExpenses || 0)}</span>
                        </div>
                    </div>

                    {/* Closing */}
                    <div className="border-t-2 border-border pt-4 flex justify-between items-center">
                        <span className="text-lg font-bold">Kasa Bakiye</span>
                        <span className={cn('text-2xl font-bold', closingBalance >= 0 ? 'text-green-600' : 'text-destructive')}>
                            {formatCurrency(closingBalance)}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <button onClick={() => { setNewBalance(cash.openingBalance || 0); setEditBalance(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80">
                            Açılış Bakiyesini Değiştir
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80">
                            <FileText className="w-4 h-4" /> PDF İndir
                        </button>
                        <button onClick={() => window.print()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80">
                            <Printer className="w-4 h-4" /> Yazdır
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ===================== EXPENSES TAB =====================
function ExpensesTab({ range }) {
    const queryClient = useQueryClient();
    const [showAdd, setShowAdd] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['finance-expenses', range],
        queryFn: () => financeApi.getExpenses({ range })
    });

    const expenses = data?.expenses || [];

    const total = useMemo(() => expenses.reduce((s, e) => s + (e.amount || 0), 0), [expenses]);

    if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="bg-destructive/10 rounded-lg px-4 py-2">
                    <span className="text-sm text-muted-foreground mr-2">Toplam Gider:</span>
                    <span className="font-bold text-destructive">{formatCurrency(total)}</span>
                </div>
                <button onClick={() => setShowAdd(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                    <Plus className="w-4 h-4" /> Yeni Gider
                </button>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="text-left px-4 py-2.5 font-medium">Tarih</th>
                            <th className="text-left px-4 py-2.5 font-medium">Kategori</th>
                            <th className="text-left px-4 py-2.5 font-medium">Açıklama</th>
                            <th className="text-right px-4 py-2.5 font-medium">Tutar</th>
                            <th className="text-left px-4 py-2.5 font-medium">Not</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {expenses.map((e, i) => (
                            <tr key={i} className="hover:bg-muted/30">
                                <td className="px-4 py-2.5">{formatDate(e.date)}</td>
                                <td className="px-4 py-2.5">
                                    <span className="px-2 py-0.5 rounded bg-muted text-xs font-medium">
                                        {getCategoryLabel(e.category)}
                                    </span>
                                    {e.subCategory && (
                                        <span className="ml-1 text-xs text-muted-foreground">({getSubCategoryLabel(e.subCategory)})</span>
                                    )}
                                </td>
                                <td className="px-4 py-2.5 text-muted-foreground">{e.description || '-'}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-destructive">{formatCurrency(e.amount)}</td>
                                <td className="px-4 py-2.5 text-muted-foreground">{e.note || '-'}</td>
                            </tr>
                        ))}
                        {expenses.length === 0 && (
                            <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Gider kaydı bulunamadı</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showAdd && (
                <AddExpenseModal
                    onClose={() => setShowAdd(false)}
                    onSave={() => { queryClient.invalidateQueries({ queryKey: ['finance-expenses'] }); setShowAdd(false); }}
                />
            )}
        </div>
    );
}

// ===================== ADD EXPENSE MODAL =====================
function AddExpenseModal({ onClose, onSave }) {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        category: 'material',
        subCategory: '',
        description: '',
        amount: 0,
        note: ''
    });

    const mutation = useMutation({
        mutationFn: (data) => financeApi.addExpense(data),
        onSuccess: () => { toast.success('Gider kaydedildi'); onSave(); },
        onError: () => toast.error('Gider kaydedilemedi')
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (formData.category === 'other' && !formData.description.trim()) {
            toast.error('"Diğer" kategorisinde açıklama zorunludur');
            return;
        }
        mutation.mutate(formData);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Yeni Gider</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Tarih</label>
                        <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Kategori</label>
                        <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value, subCategory: '' })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none">
                            {expenseCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>
                    {formData.category === 'utilities' && (
                        <div>
                            <label className="block text-sm font-medium mb-1">Alt Kategori</label>
                            <select value={formData.subCategory} onChange={e => setFormData({ ...formData, subCategory: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none">
                                <option value="">Seçiniz</option>
                                {utilitySubCategories.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                    )}
                    {formData.category === 'other' && (
                        <div>
                            <label className="block text-sm font-medium mb-1">Açıklama <span className="text-destructive">*</span></label>
                            <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Giderin ne olduğunu belirtin..."
                                className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none" />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium mb-1">Tutar (₺)</label>
                        <input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                            min={0} className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Not</label>
                        <textarea value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })}
                            rows={2} placeholder="Opsiyonel not..."
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none resize-none" />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">İptal</button>
                        <button type="submit" disabled={mutation.isPending}
                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Kaydet
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ===================== OVERDUE PAYMENTS TAB =====================
function OverdueTab() {
    const [selected, setSelected] = useState(new Set());

    const { data, isLoading } = useQuery({
        queryKey: ['finance-overdue'],
        queryFn: () => financeApi.getOverduePayments()
    });

    const overdueList = data?.overdue || [];

    const toggleSelect = (id) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelected(next);
    };

    const selectAll = () => {
        if (selected.size === overdueList.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(overdueList.map(o => o.id)));
        }
    };

    const sendWhatsApp = async () => {
        const items = overdueList.filter(o => selected.has(o.id));
        if (!items.length) { toast.error('Lütfen müşteri seçin'); return; }

        for (const item of items) {
            const msg = `Merhaba ${item.customerName}, ${item.archiveNumber} numaralı arşivinize ait ${formatCurrency(item.remaining)} tutarında ödemeniz bulunmaktadır. Bilgilerinize.`;
            try {
                await whatsappApi.send({ phone: item.phone, message: msg });
                // Random delay between messages: 2-5s
                await new Promise(r => setTimeout(r, Math.random() * 3000 + 2000));
            } catch { /* continue */ }
        }
        toast.success(`${items.length} müşteriye mesaj gönderildi`);
    };

    if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

    const totalOverdue = overdueList.reduce((s, o) => s + (o.remaining || 0), 0);

    return (
        <div className="space-y-4">
            {/* Summary + actions */}
            <div className="flex items-center justify-between">
                <div className="bg-destructive/10 rounded-lg px-4 py-2">
                    <span className="text-sm text-muted-foreground mr-2">Toplam Geciken:</span>
                    <span className="font-bold text-destructive">{formatCurrency(totalOverdue)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({overdueList.length} müşteri)</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={selectAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80">
                        {selected.size === overdueList.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        {selected.size === overdueList.length ? 'Temizle' : 'Tümünü Seç'}
                    </button>
                    <button onClick={sendWhatsApp} disabled={selected.size === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                        <MessageCircle className="w-4 h-4" /> Seçilenlere WhatsApp Gönder
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="w-10 px-3 py-2.5"></th>
                            <th className="text-left px-4 py-2.5 font-medium">Müşteri</th>
                            <th className="text-left px-4 py-2.5 font-medium">Telefon</th>
                            <th className="text-left px-4 py-2.5 font-medium">Arşiv No</th>
                            <th className="text-right px-4 py-2.5 font-medium">Toplam</th>
                            <th className="text-right px-4 py-2.5 font-medium">Ödenen</th>
                            <th className="text-right px-4 py-2.5 font-medium">Kalan</th>
                            <th className="text-right px-4 py-2.5 font-medium">Gün</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {overdueList.map((o) => (
                            <tr key={o.id} className="hover:bg-muted/30">
                                <td className="px-3 py-2.5 text-center">
                                    <button onClick={() => toggleSelect(o.id)}>
                                        {selected.has(o.id)
                                            ? <CheckSquare className="w-4 h-4 text-primary" />
                                            : <Square className="w-4 h-4 text-muted-foreground" />}
                                    </button>
                                </td>
                                <td className="px-4 py-2.5 font-medium">{o.customerName}</td>
                                <td className="px-4 py-2.5 text-muted-foreground">{o.phone}</td>
                                <td className="px-4 py-2.5">{o.archiveNumber}</td>
                                <td className="px-4 py-2.5 text-right">{formatCurrency(o.totalAmount)}</td>
                                <td className="px-4 py-2.5 text-right text-green-600">{formatCurrency(o.paidAmount)}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-destructive">{formatCurrency(o.remaining)}</td>
                                <td className="px-4 py-2.5 text-right">
                                    <span className={cn('px-2 py-0.5 rounded text-xs font-medium',
                                        o.daysPassed > 60 ? 'bg-red-500/10 text-red-600' :
                                            o.daysPassed > 30 ? 'bg-orange-500/10 text-orange-600' :
                                                'bg-yellow-500/10 text-yellow-600')}>
                                        {o.daysPassed} gün
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {overdueList.length === 0 && (
                            <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Geciken ödeme yok 🎉</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ===================== MAIN COMPONENT =====================
export default function Finance() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [range, setRange] = useState('month');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <DollarSign className="w-7 h-7" /> Finans
                </h1>
                <div className="flex bg-muted rounded-lg p-1">
                    {dateRanges.map(r => (
                        <button key={r.key} onClick={() => setRange(r.key)}
                            className={cn('px-4 py-1.5 text-sm rounded-md transition-colors',
                                range === r.key ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                            {r.label}
                        </button>
                    ))}
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

            {/* Tab Content */}
            {activeTab === 'dashboard' && <DashboardTab range={range} />}
            {activeTab === 'payments' && <PaymentsTab range={range} />}
            {activeTab === 'cash' && <CashTab range={range} />}
            {activeTab === 'expenses' && <ExpensesTab range={range} />}
            {activeTab === 'overdue' && <OverdueTab />}
        </div>
    );
}

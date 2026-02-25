import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '../services/api';
import { formatDate, formatCurrency, cn } from '../lib/utils';
import {
    Wallet, Plus, X, Loader2, Banknote, CreditCard, ArrowUpDown,
    Calendar, RefreshCw, Pencil, Trash2, TrendingUp, TrendingDown,
    ArrowDownCircle, ArrowUpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

// =================== INCOME TYPES ===================
const INCOME_TYPES = [
    { value: 'amateur_print', label: 'Amatör Baskı' },
    { value: 'frame', label: 'Çerçeve' },
    { value: 'album', label: 'Albüm' },
    { value: 'cogaltma', label: 'Çoğaltma' },
    { value: 'digital', label: 'Dijital Ürün' },
    { value: 'repair', label: 'Tamir / Servis' },
    { value: 'other', label: 'Diğer' }
];

// =================== EXPENSE CATEGORIES (Kasa: sadece Malzeme ve Diğer) ===================
const EXPENSE_CATEGORIES = [
    { value: 'material', label: 'Malzeme' },
    { value: 'other', label: 'Diğer' }
];

const PAYMENT_METHODS = [
    { value: 'cash', label: 'Nakit', icon: Banknote, color: 'text-green-500' },
    { value: 'credit_card', label: 'Kart', icon: CreditCard, color: 'text-blue-500' },
    { value: 'transfer', label: 'Havale', icon: ArrowUpDown, color: 'text-purple-500' }
];

function getMethodLabel(method) {
    return PAYMENT_METHODS.find(m => m.value === method)?.label || method || '-';
}

function getTypeLabel(type, direction = 'income') {
    if (direction === 'expense') {
        return EXPENSE_CATEGORIES.find(t => t.value === type)?.label || type || '-';
    }
    return INCOME_TYPES.find(t => t.value === type)?.label || type || '-';
}

/** Extract the first item from an entry — handles both array and object forms */
function getItem(entry) {
    if (!entry) return {};
    const items = entry.items;
    if (Array.isArray(items) && items.length > 0) return items[0];
    // httpsCallable sometimes serializes arrays as { "0": ... }
    if (items && typeof items === 'object' && items['0']) return items['0'];
    return {};
}

// =================== ENTRY FORM MODAL ===================
function EntryFormModal({ onClose, onSave, editingEntry = null }) {
    const item = editingEntry ? getItem(editingEntry) : {};
    const today = new Date().toISOString().split('T')[0];

    const [direction, setDirection] = useState(editingEntry?.direction || 'income');
    const [form, setForm] = useState({
        date: item.date || today,
        type: item.type || (direction === 'income' ? 'amateur_print' : 'rent'),
        category: item.category || item.type || 'rent',
        description: item.description || '',
        amount: editingEntry ? String(editingEntry.totalAmount || item.totalPrice || '') : '',
        method: item.paymentMethod || 'cash',
        note: editingEntry?.note || ''
    });

    const mutation = useMutation({
        mutationFn: (data) => editingEntry
            ? financeApi.updateCashEntry({ id: editingEntry.id, ...data })
            : financeApi.createCashEntry(data),
        onSuccess: () => {
            toast.success(editingEntry ? 'Kayıt güncellendi' : 'Kayıt eklendi');
            onSave();
        },
        onError: (err) => toast.error(err?.message || 'İşlem başarısız')
    });

    const handleDirectionChange = (newDir) => {
        setDirection(newDir);
        setForm(prev => ({
            ...prev,
            type: newDir === 'income' ? 'amateur_print' : 'material',
            category: newDir === 'expense' ? 'material' : ''
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.amount || Number(form.amount) <= 0) {
            toast.error('Geçerli bir tutar girin');
            return;
        }
        if (direction === 'income') {
            mutation.mutate({
                direction: 'income',
                items: [{
                    type: form.type,
                    description: form.description || getTypeLabel(form.type, 'income'),
                    totalPrice: Number(form.amount),
                    paymentMethod: form.method,
                    date: form.date
                }],
                note: form.note || ''
            });
        } else {
            mutation.mutate({
                direction: 'expense',
                items: [{
                    type: form.category,
                    category: form.category,
                    description: form.description || getTypeLabel(form.category, 'expense'),
                    totalPrice: Number(form.amount),
                    paymentMethod: form.method,
                    date: form.date
                }],
                note: form.note || ''
            });
        }
    };

    const currentTypes = direction === 'income' ? INCOME_TYPES : EXPENSE_CATEGORIES;
    const currentValue = direction === 'income' ? form.type : form.category;
    const needsDescription = currentValue === 'other';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xl font-semibold">
                        {editingEntry ? 'Kaydı Düzenle' : 'Yeni Kayıtsız İşlem'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Direction Toggle */}
                <div className="flex mb-5 bg-muted rounded-lg p-1">
                    <button
                        type="button"
                        onClick={() => handleDirectionChange('income')}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all',
                            direction === 'income'
                                ? 'bg-green-500 text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <ArrowDownCircle className="w-4 h-4" />
                        Gelir
                    </button>
                    <button
                        type="button"
                        onClick={() => handleDirectionChange('expense')}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all',
                            direction === 'expense'
                                ? 'bg-red-500 text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <ArrowUpCircle className="w-4 h-4" />
                        Gider
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium mb-1">Tarih</label>
                            <input
                                type="date"
                                value={form.date}
                                onChange={e => setForm({ ...form, date: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                {direction === 'income' ? 'Tür' : 'Kategori'}
                            </label>
                            <select
                                value={currentValue}
                                onChange={e => {
                                    if (direction === 'income') {
                                        setForm({ ...form, type: e.target.value });
                                    } else {
                                        setForm({ ...form, category: e.target.value });
                                    }
                                }}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm"
                            >
                                {currentTypes.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {needsDescription && (
                        <div>
                            <label className="block text-sm font-medium mb-1">Açıklama <span className="text-destructive">*</span></label>
                            <input
                                type="text"
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                placeholder={direction === 'income' ? 'Ne satıldığını açıklayın...' : 'Gider detayını açıklayın...'}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium mb-1">Tutar (₺)</label>
                        <input
                            type="number"
                            value={form.amount}
                            onChange={e => setForm({ ...form, amount: e.target.value })}
                            min={0}
                            step={0.01}
                            placeholder="0,00"
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Ödeme Yöntemi</label>
                        <div className="flex gap-2">
                            {PAYMENT_METHODS.map(m => {
                                const Icon = m.icon;
                                return (
                                    <button
                                        key={m.value}
                                        type="button"
                                        onClick={() => setForm({ ...form, method: m.value })}
                                        className={cn(
                                            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-colors',
                                            form.method === m.value
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-border hover:bg-muted/50'
                                        )}
                                    >
                                        <Icon className={cn('w-4 h-4', form.method === m.value ? 'text-primary' : m.color)} />
                                        {m.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Not</label>
                        <textarea
                            value={form.note}
                            onChange={e => setForm({ ...form, note: e.target.value })}
                            rows={2}
                            placeholder="Opsiyonel not..."
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none resize-none text-sm"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className={cn(
                                'flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2',
                                direction === 'income'
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-red-600 hover:bg-red-700'
                            )}
                        >
                            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            {editingEntry ? 'Güncelle' : (direction === 'income' ? 'Gelir Ekle' : 'Gider Ekle')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// =================== MAIN COMPONENT ===================
export default function CashRegister() {
    const queryClient = useQueryClient();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [showForm, setShowForm] = useState(false);
    const [editingEntry, setEditingEntry] = useState(null);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['cash-register', selectedDate],
        queryFn: () => financeApi.getCashRegisterEntries(selectedDate),
        retry: 1
    });

    const entries = data?.entries || [];
    const summary = data?.summary || { cash: 0, card: 0, transfer: 0, total: 0, totalIncome: 0, totalExpense: 0 };

    const deleteMutation = useMutation({
        mutationFn: ({ id }) => financeApi.deleteCashEntry({ id }),
        onSuccess: () => {
            toast.success('Kayıt silindi');
            queryClient.invalidateQueries({ queryKey: ['cash-register'] });
        },
        onError: (err) => toast.error(err?.message || 'Silinemedi')
    });

    const handleSave = () => {
        queryClient.invalidateQueries({ queryKey: ['cash-register'] });
        setShowForm(false);
        setEditingEntry(null);
    };

    const handleEdit = (entry) => {
        setEditingEntry(entry);
        setShowForm(true);
    };

    const handleDelete = (entry) => {
        if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
        deleteMutation.mutate({ id: entry.id });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Wallet className="w-7 h-7" /> Kasa — Kayıtsız İşlemler
                    </h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Amatör baskı, çerçeve, albüm gibi kayıtsız satışlar ve giderler
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="bg-transparent text-sm outline-none"
                        />
                    </div>
                    <button
                        onClick={() => refetch()}
                        className="p-2 hover:bg-muted rounded-lg"
                        title="Yenile"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { setEditingEntry(null); setShowForm(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                    >
                        <Plus className="w-4 h-4" /> Yeni Ekle
                    </button>
                </div>
            </div>

            {/* Daily Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Nakit Gelir</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(summary.cash)}</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Kart Gelir</p>
                    <p className="text-lg font-bold text-blue-600">{formatCurrency(summary.card)}</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Havale Gelir</p>
                    <p className="text-lg font-bold text-purple-600">{formatCurrency(summary.transfer)}</p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-1 mb-1">
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                        <p className="text-xs text-muted-foreground">Toplam Gelir</p>
                    </div>
                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(summary.totalIncome)}</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-1 mb-1">
                        <TrendingDown className="w-3 h-3 text-red-500" />
                        <p className="text-xs text-muted-foreground">Toplam Gider</p>
                    </div>
                    <p className="text-lg font-bold text-red-600">{formatCurrency(summary.totalExpense)}</p>
                </div>
                <div className={cn(
                    'border rounded-xl p-4',
                    summary.total >= 0
                        ? 'bg-primary/10 border-primary/20'
                        : 'bg-orange-500/10 border-orange-500/20'
                )}>
                    <p className="text-xs text-muted-foreground mb-1">Net</p>
                    <p className={cn(
                        'text-lg font-bold',
                        summary.total >= 0 ? 'text-primary' : 'text-orange-600'
                    )}>
                        {formatCurrency(summary.total)}
                    </p>
                </div>
            </div>

            {/* Entries Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                    <h3 className="font-semibold text-sm">
                        {formatDate(selectedDate)} — İşlemler
                    </h3>
                    <span className="text-xs text-muted-foreground">{entries.length} kayıt</span>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-muted/20">
                            <tr>
                                <th className="text-left px-4 py-2.5 font-medium w-10">Yön</th>
                                <th className="text-left px-4 py-2.5 font-medium">Tür</th>
                                <th className="text-left px-4 py-2.5 font-medium">Açıklama</th>
                                <th className="text-left px-4 py-2.5 font-medium">Yöntem</th>
                                <th className="text-right px-4 py-2.5 font-medium">Tutar</th>
                                <th className="text-left px-4 py-2.5 font-medium">Not</th>
                                <th className="text-right px-4 py-2.5 font-medium w-20">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {entries.map((entry) => {
                                const item = getItem(entry);
                                const dir = entry.direction || 'income';
                                const isIncome = dir === 'income';
                                const methodInfo = PAYMENT_METHODS.find(m => m.value === item.paymentMethod);
                                const MethodIcon = methodInfo?.icon || Banknote;
                                const amount = Number(entry.totalAmount) || Number(item.totalPrice) || 0;
                                return (
                                    <tr key={entry.id} className="hover:bg-muted/20 group">
                                        <td className="px-4 py-2.5">
                                            {isIncome ? (
                                                <ArrowDownCircle className="w-4 h-4 text-green-500" title="Gelir" />
                                            ) : (
                                                <ArrowUpCircle className="w-4 h-4 text-red-500" title="Gider" />
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={cn(
                                                'px-2 py-0.5 rounded text-xs font-medium',
                                                isIncome
                                                    ? 'bg-green-500/10 text-green-700'
                                                    : 'bg-red-500/10 text-red-700'
                                            )}>
                                                {getTypeLabel(item.category || item.type, dir)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-muted-foreground">
                                            {item.description || '-'}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={cn('flex items-center gap-1.5 text-xs font-medium', methodInfo?.color || '')}>
                                                <MethodIcon className="w-3.5 h-3.5" />
                                                {getMethodLabel(item.paymentMethod)}
                                            </span>
                                        </td>
                                        <td className={cn(
                                            'px-4 py-2.5 text-right font-semibold',
                                            isIncome ? 'text-green-600' : 'text-red-600'
                                        )}>
                                            {isIncome ? '+' : '-'}{formatCurrency(amount)}
                                        </td>
                                        <td className="px-4 py-2.5 text-muted-foreground text-xs">
                                            {entry.note || '-'}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(entry)}
                                                    className="p-1.5 hover:bg-blue-500/10 rounded-lg text-blue-500"
                                                    title="Düzenle"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(entry)}
                                                    className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500"
                                                    title="Sil"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {entries.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                                        <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        <p>Bu tarihte kayıt yok</p>
                                        <button
                                            onClick={() => { setEditingEntry(null); setShowForm(true); }}
                                            className="mt-3 px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg"
                                        >
                                            İlk Kaydı Ekle
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {showForm && (
                <EntryFormModal
                    onClose={() => { setShowForm(false); setEditingEntry(null); }}
                    onSave={handleSave}
                    editingEntry={editingEntry}
                />
            )}
        </div>
    );
}

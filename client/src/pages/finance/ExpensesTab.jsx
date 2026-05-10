import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '../../services/api';
import { formatDate, formatCurrency } from '../../lib/utils';
import { Plus, X, Loader2 } from 'lucide-react';
import { SkeletonTable } from '../../components/Skeleton';
import notify from '../../lib/notify';

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

function getSubCategoryLabel(sub, t) {
    const utilitySubCategories = [
        { value: 'electricity', label: t('pages.finance.electricity') },
        { value: 'water', label: t('pages.finance.water') },
        { value: 'gas', label: t('pages.finance.gas') },
        { value: 'internet', label: t('pages.finance.internet') }
    ];
    return utilitySubCategories.find(s => s.value === sub)?.label || sub;
}

function AddExpenseModal({ onClose, onSave }) {
    const { t } = useTranslation();
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

    const utilitySubCategories = [
        { value: 'electricity', label: t('pages.finance.electricity') },
        { value: 'water', label: t('pages.finance.water') },
        { value: 'gas', label: t('pages.finance.gas') },
        { value: 'internet', label: t('pages.finance.internet') }
    ];

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
        onSuccess: () => { notify.success(t('common.success')); onSave(); },
        onError: () => notify.error(t('common.failed'))
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (formData.category === 'other' && !formData.description.trim()) {
            notify.error(t('errors.required'));
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

export default function ExpensesTab({ range }) {
    const queryClient = useQueryClient();
    const [showAdd, setShowAdd] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['finance-expenses', range],
        queryFn: () => financeApi.getExpenses({ range })
    });

    const expenses = data?.expenses || [];
    const total = useMemo(() => expenses.reduce((s, e) => s + (e.amount || 0), 0), [expenses]);

    if (isLoading) return <SkeletonTable rows={8} columns={5} />;

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

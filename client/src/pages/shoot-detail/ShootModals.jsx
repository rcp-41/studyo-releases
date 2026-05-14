import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { shootsApi } from '../../services/api';
import notify from '../../lib/notify';
import { formatCurrency } from '../../lib/utils';
import { X, Loader2 } from 'lucide-react';

// ==================== EDIT SHOOT MODAL ====================
export function EditShootModal({ shoot, onClose, onSave }) {
    const [formData, setFormData] = useState({
        location: shoot.location || '',
        notes: shoot.notes || '',
        totalAmount: shoot.totalAmount || 0
    });

    const updateMutation = useMutation({
        mutationFn: (data) => shootsApi.update(shoot.id, data),
        onSuccess: () => { notify.success('Çekim güncellendi'); onSave(); },
        onError: () => notify.error('Güncelleme başarısız')
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Çekim Düzenle</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={e => { e.preventDefault(); updateMutation.mutate(formData); }} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Lokasyon</label>
                        <input type="text" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Toplam Tutar (₺)</label>
                        <input type="number" value={formData.totalAmount} onChange={e => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Notlar</label>
                        <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none resize-none" rows={3} />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">İptal</button>
                        <button type="submit" disabled={updateMutation.isPending}
                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                            {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Güncelle
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ==================== PAYMENT MODAL ====================
export function PaymentModal({ shoot, onClose, onSave }) {
    const [amount, setAmount] = useState(shoot.remainingAmount || 0);
    const [method, setMethod] = useState('cash');
    const [note, setNote] = useState('');

    const paymentMutation = useMutation({
        mutationFn: (data) => shootsApi.addPayment(shoot.id, data),
        onSuccess: () => { notify.success('Ödeme kaydedildi'); onSave(); },
        onError: () => notify.error('Ödeme kaydedilemedi')
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Ödeme Al</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <div className="mb-4 p-3 bg-muted rounded-lg text-sm">
                    <div className="flex justify-between"><span>Toplam:</span><span className="font-medium">{formatCurrency(shoot.totalAmount)}</span></div>
                    <div className="flex justify-between"><span>Ödenen:</span><span className="text-green-600">{formatCurrency(shoot.paidAmount)}</span></div>
                    <div className="flex justify-between border-t border-border pt-2 mt-2"><span>Kalan:</span><span className="font-semibold text-destructive">{formatCurrency(shoot.remainingAmount)}</span></div>
                </div>
                <form onSubmit={e => { e.preventDefault(); paymentMutation.mutate({ amount, method, note }); }} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Tutar (₺)</label>
                        <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))}
                            max={shoot.remainingAmount}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Ödeme Yöntemi</label>
                        <select value={method} onChange={e => setMethod(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none">
                            <option value="cash">Nakit</option>
                            <option value="credit_card">Kredi Kartı</option>
                            <option value="transfer">Havale/EFT</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Not</label>
                        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Ödeme notu..."
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">İptal</button>
                        <button type="submit" disabled={paymentMutation.isPending}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                            {paymentMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Ödemeyi Kaydet
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

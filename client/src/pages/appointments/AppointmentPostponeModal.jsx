import { useState } from 'react';
import { format } from 'date-fns';
import notify from '../../lib/notify';

export default function AppointmentPostponeModal({ appointment, slots, onClose, onSave }) {
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [saving, setSaving] = useState(false);

    if (!appointment) return null;

    const handleSave = async () => {
        if (!newDate || !newTime) { notify.error('Tarih ve saat seçin'); return; }
        setSaving(true);
        try {
            await onSave({ newDate, newTime });
        } catch {
            notify.error('Erteleme başarısız');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div className="bg-card border border-border rounded-xl p-6 w-96 space-y-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold">Randevuyu Ertele</h3>
                <p className="text-sm text-muted-foreground">
                    {appointment.fullName || appointment.customer?.fullName} — {appointment.timeSlot}
                </p>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">Yeni Tarih</label>
                        <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                            min={format(new Date(), 'yyyy-MM-dd')}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Yeni Saat</label>
                        <select value={newTime} onChange={e => setNewTime(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input">
                            <option value="">Saat seçin...</option>
                            {slots.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex gap-2 pt-2">
                    <button onClick={onClose}
                        className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">
                        İptal
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                        Ertele
                    </button>
                </div>
            </div>
        </div>
    );
}

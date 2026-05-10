import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi, optionsApi } from '../../services/api';
import { X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import notify from '../../lib/notify';
import { cn } from '../../lib/utils';
import PhoneInput from '../../components/PhoneInput';

// ==================== ADD/EDIT APPOINTMENT MODAL ====================
export function AppointmentModal({ isOpen, onClose, selectedDate, timeSlot, appointment }) {
    const [formData, setFormData] = useState({
        fullName: '', phone: '', shootTypeId: '',
        description1: '', description2: '', timeSlot: '',
        appointmentDate: '', duration: 30, studioRoom: ''
    });
    const [conflicts, setConflicts] = useState([]);
    const queryClient = useQueryClient();
    const isEdit = !!appointment;

    const { data: shootTypes } = useQuery({ queryKey: ['shootTypes'], queryFn: () => optionsApi.getShootTypes().then(r => r.data) });

    useEffect(() => {
        if (isOpen) {
            setConflicts([]);
            if (appointment) {
                setFormData({
                    fullName: appointment.fullName || appointment.customer?.fullName || '',
                    phone: appointment.phone || appointment.customer?.phone || '',
                    shootTypeId: appointment.shootTypeId?.toString() || '',
                    description1: appointment.description1 || '',
                    description2: appointment.description2 || '',
                    timeSlot: appointment.timeSlot || '',
                    appointmentDate: appointment.appointmentDate ? format(new Date(appointment.appointmentDate), 'yyyy-MM-dd') : '',
                    duration: appointment.duration || 30,
                    studioRoom: appointment.studioRoom || ''
                });
            } else {
                setFormData({
                    fullName: '', phone: '', shootTypeId: shootTypes?.[0]?.id?.toString() || '',
                    description1: '', description2: '',
                    timeSlot: timeSlot || '',
                    appointmentDate: selectedDate || '',
                    duration: 30, studioRoom: ''
                });
            }
        }
    }, [isOpen, appointment, selectedDate, timeSlot, shootTypes]);

    const createMutation = useMutation({
        mutationFn: (data) => appointmentsApi.create(data),
        onSuccess: (result) => {
            if (result?.hasConflict && !result?.success) {
                setConflicts(result.conflicts || []);
                return;
            }
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            notify.success('Randevu oluşturuldu');
            onClose();
        },
        onError: () => notify.error('Randevu oluşturulamadı')
    });

    const updateMutation = useMutation({
        mutationFn: (data) => appointmentsApi.update(appointment.id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); notify.success('Randevu güncellendi'); onClose(); },
        onError: () => notify.error('Randevu güncellenemedi')
    });

    const deleteMutation = useMutation({
        mutationFn: () => appointmentsApi.delete(appointment.id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); notify.success('Randevu silindi'); onClose(); },
        onError: () => notify.error('Randevu silinemedi')
    });

    const handleSubmit = (e, forceCreate = false) => {
        e?.preventDefault?.();
        if (!formData.fullName || !formData.phone || !formData.shootTypeId) {
            notify.error('Zorunlu alanları doldurun');
            return;
        }
        if (isEdit) {
            updateMutation.mutate(formData);
        } else {
            createMutation.mutate({ ...formData, forceCreate });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 select-text">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">{isEdit ? 'Randevu Düzenle' : 'Yeni Randevu'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium mb-1">Adı Soyadı *</label>
                            <input type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">Telefon *</label>
                            <PhoneInput
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                onCustomerFound={(customer) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        fullName: customer.fullName || prev.fullName
                                    }));
                                }}
                                className="text-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">Çekim Türü *</label>
                        <select value={formData.shootTypeId} onChange={e => setFormData({ ...formData, shootTypeId: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm">
                            <option value="">Seçin...</option>
                            {shootTypes?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium mb-1">Tarih</label>
                            <input type="date" value={formData.appointmentDate} onChange={e => setFormData({ ...formData, appointmentDate: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">Saat</label>
                            <input type="time" value={formData.timeSlot} onChange={e => setFormData({ ...formData, timeSlot: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm" step="1800" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">Stüdyo Odası</label>
                        <input type="text" value={formData.studioRoom} onChange={e => setFormData({ ...formData, studioRoom: e.target.value })}
                            placeholder="Ör: Stüdyo 1, Oda A..."
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">Açıklama 1</label>
                        <input type="text" value={formData.description1} onChange={e => setFormData({ ...formData, description1: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">Açıklama 2</label>
                        <input type="text" value={formData.description2} onChange={e => setFormData({ ...formData, description2: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm" />
                    </div>

                    {conflicts.length > 0 && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                            <p className="text-sm font-medium text-amber-600 mb-2">Çakışan Randevular:</p>
                            {conflicts.map((c, i) => (
                                <div key={i} className="text-xs text-amber-700 mb-1">
                                    {c.fullName} - {c.timeSlot} {c.studioRoom ? `(${c.studioRoom})` : ''}
                                    {c.sameRoom && <span className="ml-1 text-red-600 font-medium">Aynı oda!</span>}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => handleSubmit(null, true)}
                                className="mt-2 px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                            >
                                Yine de Ekle
                            </button>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        {isEdit && (
                            <button type="button" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
                                className="px-4 py-2 border border-destructive text-destructive rounded-lg hover:bg-destructive/10 disabled:opacity-50">
                                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sil'}
                            </button>
                        )}
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">İptal</button>
                        <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                            {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isEdit ? 'Güncelle' : 'Kaydet'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ==================== MOVE APPOINTMENT MODAL ====================
export function MoveAppointmentModal({ isOpen, onClose, appointment }) {
    const [newDate, setNewDate] = useState('');
    const [newSlot, setNewSlot] = useState('');
    const queryClient = useQueryClient();

    const { data: dayData } = useQuery({
        queryKey: ['appointments', 'day', newDate],
        queryFn: () => appointmentsApi.getDay(newDate).then(r => r.data),
        enabled: !!newDate
    });

    const availableSlots = useMemo(() => {
        if (!dayData?.slots) return [];
        return Object.entries(dayData.slots)
            .filter(([_, apt]) => !apt)
            .map(([slot]) => slot);
    }, [dayData]);

    const moveMutation = useMutation({
        mutationFn: () => appointmentsApi.update(appointment.id, { appointmentDate: newDate, timeSlot: newSlot }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); notify.success('Randevu taşındı'); onClose(); },
        onError: () => notify.error('Randevu taşınamadı')
    });

    if (!isOpen || !appointment) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6 select-text">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Randevu Taşı</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{appointment.fullName || appointment.customer?.fullName}</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium mb-1">Yeni Tarih</label>
                        <input type="date" value={newDate} onChange={e => { setNewDate(e.target.value); setNewSlot(''); }}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm" />
                    </div>

                    {newDate && (
                        <div>
                            <label className="block text-xs font-medium mb-1">Boş Saatler</label>
                            {availableSlots.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Bu tarihte boş saat yok</p>
                            ) : (
                                <div className="grid grid-cols-4 gap-1 max-h-40 overflow-y-auto">
                                    {availableSlots.map(slot => (
                                        <button key={slot} onClick={() => setNewSlot(slot)}
                                            className={cn('px-2 py-1.5 rounded text-xs font-mono border transition-colors',
                                                newSlot === slot ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted')}>
                                            {slot}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted text-sm">İptal</button>
                        <button onClick={() => moveMutation.mutate()} disabled={!newDate || !newSlot || moveMutation.isPending}
                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                            {moveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Taşı
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi, optionsApi } from '../../services/api';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { X, Loader2 } from 'lucide-react';
import notify from '../../lib/notify';

export default function AppointmentModal({ isOpen, onClose, date, timeSlot, appointment }) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({ fullName: '', phone: '', shootTypeId: '', description1: '', description2: '' });
    const queryClient = useQueryClient();
    const isEdit = !!appointment;

    const { data: shootTypes } = useQuery({
        queryKey: ['shootTypes'],
        queryFn: () => optionsApi.getShootTypes().then(r => r.data)
    });

    useEffect(() => {
        if (appointment) {
            setFormData({
                fullName: appointment.fullName || '',
                phone: appointment.phone || '',
                shootTypeId: appointment.shootTypeId?.toString() || '',
                description1: appointment.description1 || '',
                description2: appointment.description2 || ''
            });
        } else {
            setFormData({ fullName: '', phone: '', shootTypeId: '', description1: '', description2: '' });
        }
    }, [appointment]);

    const createMutation = useMutation({
        mutationFn: (data) => appointmentsApi.create({ ...data, appointmentDate: date, timeSlot }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            notify.success(t('pages.archives.appointmentCreated'));
            onClose();
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data) => appointmentsApi.update(appointment.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            notify.success(t('pages.archives.appointmentUpdated'));
            onClose();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: () => appointmentsApi.delete(appointment.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            notify.success(t('pages.archives.appointmentDeleted'));
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.fullName || !formData.phone || !formData.shootTypeId) {
            notify.error(t('pages.archives.requiredFieldsError'));
            return;
        }
        if (isEdit) updateMutation.mutate(formData);
        else createMutation.mutate(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 select-text">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-semibold">{isEdit ? 'Randevu Düzenle' : 'Yeni Randevu'}</h2>
                        <p className="text-sm text-muted-foreground">
                            {format(new Date(date), 'd MMMM yyyy', { locale: tr })} - {timeSlot || appointment?.timeSlot}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Adı Soyadı *</label>
                        <input type="text" value={formData.fullName}
                            onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Telefon *</label>
                        <input type="tel" value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Çekim Türü *</label>
                        <select value={formData.shootTypeId}
                            onChange={e => setFormData({ ...formData, shootTypeId: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none">
                            <option value="">Seçin...</option>
                            {shootTypes?.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Açıklama 1</label>
                        <input type="text" value={formData.description1}
                            onChange={e => setFormData({ ...formData, description1: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div className="flex gap-3 pt-4">
                        {isEdit && (
                            <button type="button" onClick={() => deleteMutation.mutate()}
                                className="px-4 py-2 border border-destructive text-destructive rounded-lg hover:bg-destructive/10">
                                Sil
                            </button>
                        )}
                        <button type="button" onClick={onClose}
                            className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">
                            İptal
                        </button>
                        <button type="submit"
                            disabled={createMutation.isPending || updateMutation.isPending}
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

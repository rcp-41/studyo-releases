/**
 * Appointments — Orchestrator (refactored)
 * Alt-bileşenler: AppointmentsCalendar (MonthView), AppointmentViews (WeekView, DayView),
 *                 AppointmentForm (AppointmentModal), AppointmentContextMenu,
 *                 AppointmentPostponeModal, constants
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi, settingsApi } from '../services/api';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Calendar, Clock, Check, XCircle,
    CalendarDays, CalendarRange, CalendarCheck
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import notify from '../lib/notify';
import ConfirmDialog from '../components/ConfirmDialog';
import { SkeletonTable } from '../components/Skeleton';
import useUndoable from '../hooks/useUndoable';

import { MonthView } from './appointments/AppointmentsCalendar';
import { WeekView, DayView } from './appointments/AppointmentViews';
import { AppointmentModal } from './appointments/AppointmentForm';
import AppointmentContextMenu from './appointments/AppointmentContextMenu';
import AppointmentPostponeModal from './appointments/AppointmentPostponeModal';
import { generateSlots, appointmentTypes } from './appointments/constants';

// ==================== MOVE MODAL ====================
function MoveAppointmentModal({ isOpen, onClose, appointment }) {
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
        return Object.entries(dayData.slots).filter(([, apt]) => !apt).map(([slot]) => slot);
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
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">✕</button>
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
                            {moveMutation.isPending && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                            Taşı
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==================== MAIN ORCHESTRATOR ====================
export default function Appointments() {
    const [viewMode, setViewMode] = useState('month');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [showModal, setShowModal] = useState(false);
    const [selectedSlotDate, setSelectedSlotDate] = useState('');
    const [selectedSlotTime, setSelectedSlotTime] = useState('');
    const [editAppointment, setEditAppointment] = useState(null);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [moveAppointment, setMoveAppointment] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [postponeTarget, setPostponeTarget] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);

    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsApi.getAll().then(r => r.data)
    });

    const workingHours = settings?.general?.workingHours || { start: '09:00', end: '19:00' };
    const slots = useMemo(() => generateSlots(workingHours.start, workingHours.end), [workingHours]);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const { data: appointmentsData, isLoading } = useQuery({
        queryKey: ['appointments', 'calendar', format(monthStart, 'yyyy-MM-dd'), format(monthEnd, 'yyyy-MM-dd')],
        queryFn: () => appointmentsApi.calendar(
            format(monthStart, 'yyyy-MM-dd'),
            format(monthEnd, 'yyyy-MM-dd')
        ).then(res => res.data || res)
    });

    const appointments = Array.isArray(appointmentsData) ? appointmentsData : (appointmentsData?.appointments || []);

    const statusMutation = useMutation({
        mutationFn: ({ id, status }) => appointmentsApi.updateStatus(id, status),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); notify.success('Durum güncellendi'); }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => appointmentsApi.update(id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => appointmentsApi.delete(id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); },
        onError: () => { notify.error('Randevu silinemedi — değişiklikler geri alındı'); queryClient.invalidateQueries({ queryKey: ['appointments'] }); }
    });

    const undoableDelete = useUndoable({
        onConfirm: ({ id }) => deleteMutation.mutateAsync(id),
        onUndo: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
        message: '',
        delayMs: 8000
    });

    const triggerUndoableDelete = (apt) => {
        if (!apt?.id) return;
        const label = apt.fullName || apt.customer?.fullName || 'Randevu';
        queryClient.setQueriesData({ queryKey: ['appointments'] }, (old) => {
            if (!old) return old;
            if (Array.isArray(old)) return old.filter(x => x.id !== apt.id);
            if (Array.isArray(old.appointments)) return { ...old, appointments: old.appointments.filter(x => x.id !== apt.id) };
            if (Array.isArray(old.data)) return { ...old, data: old.data.filter(x => x.id !== apt.id) };
            return old;
        });
        undoableDelete.trigger({ id: apt.id }, { message: `'${label}' silindi — Geri Al` });
    };

    const handleAppointmentDrop = async (appointmentId, newTimeSlot) => {
        try {
            await appointmentsApi.update(appointmentId, { timeSlot: newTimeSlot });
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            notify.success('Randevu taşındı');
        } catch (e) {
            notify.error('Randevu taşınamadı');
        }
    };

    const handleSlotClick = (date, time) => {
        setSelectedSlotDate(date);
        setSelectedSlotTime(time);
        setEditAppointment(null);
        setShowModal(true);
    };

    const handleContextMenu = (e, apt) => {
        setContextMenu({ x: e.clientX, y: e.clientY, appointment: apt });
    };

    const handleContextAction = (action) => {
        const apt = contextMenu.appointment;
        setContextMenu(null);
        switch (action) {
            case 'completed':
            case 'no_show':
                statusMutation.mutate({ id: apt.id, status: action });
                break;
            case 'edit':
                setEditAppointment(apt);
                setSelectedSlotDate(apt.appointmentDate ? format(new Date(apt.appointmentDate), 'yyyy-MM-dd') : '');
                setSelectedSlotTime(apt.timeSlot || '');
                setShowModal(true);
                break;
            case 'move':
                setMoveAppointment(apt);
                setShowMoveModal(true);
                break;
            case 'delete':
                setConfirmDelete(apt);
                break;
            case 'postpone':
                setPostponeTarget(apt);
                break;
            case 'archive':
                navigate('/archives', {
                    state: {
                        prefill: {
                            fullName: apt.fullName || apt.customer?.fullName || '',
                            phone: apt.phone || apt.customer?.phone || '',
                            email: apt.email || apt.customer?.email || '',
                            shootTypeId: apt.shootTypeId || '',
                            locationId: apt.locationId || '',
                            photographerId: apt.photographerId || '',
                            description1: apt.description1 || apt.notes || '',
                        },
                        openModal: true
                    }
                });
                break;
        }
    };

    const VIEW_MODES = [
        { key: 'month', label: 'Ay', icon: CalendarRange },
        { key: 'week', label: 'Hafta', icon: CalendarDays },
        { key: 'day', label: 'Gün', icon: CalendarCheck }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Randevular</h1>
                    <p className="text-muted-foreground">Randevu takvimi ve yönetimi</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                        {VIEW_MODES.map(mode => (
                            <button key={mode.key} onClick={() => setViewMode(mode.key)}
                                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                                    viewMode === mode.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                                <mode.icon className="w-4 h-4" />
                                {mode.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => { setEditAppointment(null); setSelectedSlotDate(format(currentDate, 'yyyy-MM-dd')); setSelectedSlotTime(''); setShowModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                        <Plus className="w-5 h-5" /> Yeni Randevu
                    </button>
                </div>
            </div>

            {isLoading ? (
                <SkeletonTable rows={8} columns={5} />
            ) : viewMode === 'month' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <MonthView
                        appointments={appointments}
                        selectedDate={selectedDate}
                        onSelectDate={setSelectedDate}
                        currentMonth={currentMonth}
                        onMonthChange={setCurrentMonth}
                        onViewDay={(day) => { setCurrentDate(day); setViewMode('day'); }}
                    />
                    <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
                        <h3 className="font-semibold mb-4">
                            {format(selectedDate, 'd MMMM yyyy', { locale: tr })} - Randevular
                        </h3>
                        {(() => {
                            const dayApts = appointments?.filter(apt => isSameDay(new Date(apt.appointmentDate), selectedDate)) || [];
                            if (dayApts.length === 0) return (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>Bu gün için randevu yok</p>
                                </div>
                            );
                            return (
                                <div className="space-y-3">
                                    {dayApts.map(apt => (
                                        <div key={apt.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                                            onContextMenu={(e) => { e.preventDefault(); handleContextMenu(e, apt); }}>
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    <Clock className="w-5 h-5 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">{apt.fullName || apt.customer?.fullName}</p>
                                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                        <span>{apt.timeSlot || format(new Date(apt.appointmentDate), 'HH:mm')}</span>
                                                        <span>•</span>
                                                        <span>{apt.shootType?.name || appointmentTypes.find(t => t.value === apt.appointmentType)?.label}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {apt.status === 'completed' && <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/15 text-green-600">Geldi</span>}
                                                {apt.status === 'no_show' && <span className="px-2 py-1 rounded text-xs font-medium bg-red-500/15 text-red-600">Gelmedi</span>}
                                                {(!apt.status || apt.status === 'pending') && (
                                                    <>
                                                        <button onClick={() => statusMutation.mutate({ id: apt.id, status: 'completed' })}
                                                            className="p-2 text-green-600 hover:bg-green-100 rounded-lg" title="Geldi">
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => statusMutation.mutate({ id: apt.id, status: 'no_show' })}
                                                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg" title="Gelmedi">
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            ) : viewMode === 'week' ? (
                <WeekView
                    appointments={appointments}
                    currentDate={currentDate}
                    onDateChange={setCurrentDate}
                    slots={slots}
                    onSlotClick={handleSlotClick}
                    onContextMenu={handleContextMenu}
                />
            ) : (
                <DayView
                    appointments={appointments}
                    currentDate={currentDate}
                    onDateChange={setCurrentDate}
                    slots={slots}
                    onSlotClick={handleSlotClick}
                    onContextMenu={handleContextMenu}
                    onDrop={handleAppointmentDrop}
                />
            )}

            {contextMenu && (
                <AppointmentContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    appointment={contextMenu.appointment}
                    onClose={() => setContextMenu(null)}
                    onAction={handleContextAction}
                />
            )}

            <AppointmentModal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setEditAppointment(null); }}
                selectedDate={selectedSlotDate}
                timeSlot={selectedSlotTime}
                appointment={editAppointment}
            />

            <MoveAppointmentModal
                isOpen={showMoveModal}
                onClose={() => { setShowMoveModal(false); setMoveAppointment(null); }}
                appointment={moveAppointment}
            />

            <ConfirmDialog
                open={!!confirmDelete}
                onOpenChange={(o) => !o && setConfirmDelete(null)}
                title="Randevuyu sil"
                description="Bu randevu silinecek. Emin misiniz?"
                destructive
                confirmText="Sil"
                cancelText="Vazgeç"
                onConfirm={() => {
                    if (!confirmDelete) return;
                    const apt = confirmDelete;
                    setConfirmDelete(null);
                    triggerUndoableDelete(apt);
                }}
            />

            {postponeTarget && (
                <AppointmentPostponeModal
                    appointment={postponeTarget}
                    slots={slots}
                    onClose={() => setPostponeTarget(null)}
                    onSave={async ({ newDate, newTime }) => {
                        await updateMutation.mutateAsync({ id: postponeTarget.id, data: { appointmentDate: newDate, timeSlot: newTime, status: 'pending' } });
                        notify.success('Randevu ertelendi');
                        setPostponeTarget(null);
                    }}
                />
            )}
        </div>
    );
}

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi, customersApi, optionsApi, settingsApi, dashboardApi } from '../services/api';
import { cn, formatCurrency } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import {
    Plus, ChevronLeft, ChevronRight, Calendar, Clock, User,
    X, Loader2, Check, XCircle, Edit, ArrowRightLeft,
    CalendarDays, CalendarRange, CalendarCheck, Archive
} from 'lucide-react';
import { toast } from 'sonner';
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval,
    isSameDay, addMonths, subMonths, addDays, subDays,
    startOfWeek, endOfWeek, addWeeks, subWeeks
} from 'date-fns';
import { tr } from 'date-fns/locale';
import PhoneInput from '../components/PhoneInput';
import ConfirmDialog from '../components/ConfirmDialog';
import { SkeletonTable } from '../components/Skeleton';
import useUndoable from '../hooks/useUndoable';

const appointmentTypes = [
    { value: 'consultation', label: 'Görüşme' },
    { value: 'shoot', label: 'Çekim' },
    { value: 'delivery', label: 'Teslim' },
    { value: 'payment', label: 'Ödeme' },
    { value: 'other', label: 'Diğer' }
];

const STATUS_COLORS = {
    completed: 'bg-green-500/20 border-green-500/40 text-green-600',
    no_show: 'bg-red-500/20 border-red-500/40 text-red-600'
};

// Generate time slots from working hours
function generateSlots(start = '09:00', end = '19:00') {
    const slots = [];
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let h = sh, m = sm;
    while (h < eh || (h === eh && m < em)) {
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        m += 30;
        if (m >= 60) { m = 0; h++; }
    }
    return slots;
}

// ==================== CONTEXT MENU ====================
function ContextMenu({ x, y, appointment, onClose, onAction }) {
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    return (
        <div ref={ref} className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[180px]" style={{ left: x, top: y }}>
            <button onClick={() => onAction('completed')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" /> Geldi
            </button>
            <button onClick={() => onAction('no_show')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" /> Gelmedi
            </button>
            <div className="border-t border-border my-1" />
            <button onClick={() => onAction('edit')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                <Edit className="w-4 h-4" /> Düzenle
            </button>
            <button onClick={() => onAction('postpone')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" /> Başka Güne Ertele
            </button>
            <button onClick={() => onAction('archive')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 text-blue-600">
                <Archive className="w-4 h-4" /> Arşive Aktar
            </button>
            <div className="border-t border-border my-1" />
            <button onClick={() => onAction('delete')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-destructive flex items-center gap-2">
                <X className="w-4 h-4" /> Sil
            </button>
        </div>
    );
}

// ==================== MONTH VIEW ====================
function MonthView({ appointments, selectedDate, onSelectDate, currentMonth, onMonthChange, onViewDay }) {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Memoize appointment lookup map by date string to avoid O(n) filtering per day cell
    const appointmentsByDate = useMemo(() => {
        const map = {};
        (appointments || []).forEach(apt => {
            const dateKey = format(new Date(apt.appointmentDate), 'yyyy-MM-dd');
            if (!map[dateKey]) map[dateKey] = [];
            map[dateKey].push(apt);
        });
        return map;
    }, [appointments]);

    const getAppointmentsForDay = (date) =>
        appointmentsByDate[format(date, 'yyyy-MM-dd')] || [];

    return (
        <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
                <button onClick={() => onMonthChange(subMonths(currentMonth, 1))} className="p-2 hover:bg-muted rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="font-semibold">{format(currentMonth, 'MMMM yyyy', { locale: tr })}</h3>
                <button onClick={() => onMonthChange(addMonths(currentMonth, 1))} className="p-2 hover:bg-muted rounded-lg">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
                {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(day => (
                    <div key={day} className="text-center text-xs text-muted-foreground py-1">{day}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-16" />
                ))}

                {days.map(day => {
                    const dayApts = getAppointmentsForDay(day);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isToday = isSameDay(day, new Date());

                    return (
                        <button
                            key={day.toString()}
                            onClick={() => { onSelectDate(day); onViewDay(day); }}
                            className={cn(
                                'h-16 rounded-lg text-sm relative transition-colors flex flex-col items-center justify-start pt-1',
                                isSelected ? 'bg-primary text-primary-foreground' :
                                    isToday ? 'bg-muted font-semibold' : 'hover:bg-muted'
                            )}
                        >
                            <span>{format(day, 'd')}</span>
                            {dayApts.length > 0 && (
                                <span className={cn(
                                    'text-[10px] font-bold mt-0.5 px-1.5 rounded-full',
                                    isSelected ? 'bg-primary-foreground/20' : 'bg-primary/15 text-primary'
                                )}>
                                    {dayApts.length}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ==================== WEEK VIEW ====================
function WeekView({ appointments, currentDate, onDateChange, slots, onSlotClick, onContextMenu }) {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const [hoveredSlot, setHoveredSlot] = useState(null);
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    // Memoize appointment lookup map by "date|slot" key for O(1) access per cell
    const aptSlotMap = useMemo(() => {
        const map = {};
        (appointments || []).forEach(apt => {
            const aptDate = new Date(apt.appointmentDate);
            const dateKey = format(aptDate, 'yyyy-MM-dd');
            if (apt.timeSlot) {
                map[`${dateKey}|${apt.timeSlot}`] = apt;
            }
        });
        return map;
    }, [appointments]);

    const getAptForSlot = (day, slot) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        return aptSlotMap[`${dateKey}|${slot}`] || null;
    };

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Week Navigation */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <button onClick={() => onDateChange(subWeeks(currentDate, 1))} className="p-2 hover:bg-muted rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-semibold">
                    {format(weekStart, 'd MMM', { locale: tr })} — {format(weekEnd, 'd MMM yyyy', { locale: tr })}
                </span>
                <button onClick={() => onDateChange(addWeeks(currentDate, 1))} className="p-2 hover:bg-muted rounded-lg">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Grid */}
            <div className="overflow-auto max-h-[calc(100vh-16rem)]">
                <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80 z-10">
                        <tr>
                            <th className="w-16 px-2 py-2 text-left border-r border-border font-medium">Saat</th>
                            {weekDays.map(day => (
                                <th key={day.toString()} className={cn(
                                    'px-1 py-2 text-center border-r border-border font-medium min-w-[100px]',
                                    isSameDay(day, new Date()) && 'bg-primary/10'
                                )}>
                                    <div>{format(day, 'EEE', { locale: tr })}</div>
                                    <div className="text-lg font-bold">{format(day, 'd')}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {slots.map(slot => (
                            <tr key={slot}
                                className={cn(
                                    "border-t border-border/50 transition-colors",
                                    hoveredSlot === slot && "bg-primary/5"
                                )}
                                onMouseEnter={() => setHoveredSlot(slot)}
                                onMouseLeave={() => setHoveredSlot(null)}
                            >
                                <td className={cn(
                                    "px-2 py-1 text-muted-foreground border-r border-border font-mono text-[11px] w-16",
                                    hoveredSlot === slot && "bg-primary/10 text-foreground font-semibold"
                                )}>{slot}</td>
                                {weekDays.map(day => {
                                    const apt = getAptForSlot(day, slot);
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const statusColor = apt && STATUS_COLORS[apt.status];
                                    const typeColor = apt?.shootType?.color;

                                    return (
                                        <td
                                            key={`${dateStr}-${slot}`}
                                            className={cn(
                                                'px-1 py-1 border-r border-border cursor-pointer transition-colors min-w-[100px]',
                                                apt ? (statusColor || 'bg-primary/10') : 'hover:bg-muted/50',
                                                isSameDay(day, new Date()) && !apt && 'bg-primary/5'
                                            )}
                                            style={typeColor && !statusColor ? { backgroundColor: `${typeColor}20`, borderLeft: `3px solid ${typeColor}` } : {}}
                                            onClick={() => !apt && onSlotClick(dateStr, slot)}
                                            onContextMenu={(e) => { if (apt) { e.preventDefault(); onContextMenu(e, apt); } }}
                                        >
                                            {apt && (
                                                <div className="truncate text-[11px] font-medium px-1">
                                                    {apt.fullName || apt.customer?.fullName}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ==================== DAY VIEW ====================
function DayView({ appointments, currentDate, onDateChange, slots, onSlotClick, onContextMenu, onDrop }) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const [dragOverSlot, setDragOverSlot] = useState(null);

    // Memoize appointment lookup map by timeSlot for O(1) access per slot
    const aptSlotMap = useMemo(() => {
        const map = {};
        (appointments || []).forEach(apt => {
            const aptDate = new Date(apt.appointmentDate);
            if (isSameDay(aptDate, currentDate) && apt.timeSlot) {
                map[apt.timeSlot] = apt;
            }
        });
        return map;
    }, [appointments, currentDate]);

    const getAptForSlot = (slot) => {
        return aptSlotMap[slot] || null;
    };

    const handleDragStart = (e, apt) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ id: apt.id, timeSlot: apt.timeSlot }));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, slot) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverSlot(slot);
    };

    const handleDragLeave = () => setDragOverSlot(null);

    const handleDrop = (e, targetSlot) => {
        e.preventDefault();
        setDragOverSlot(null);
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data.id && data.timeSlot !== targetSlot) {
                onDrop?.(data.id, targetSlot, dateStr);
            }
        } catch (e) { console.warn('Operation failed:', e?.message); }
    };

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Day Navigation */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <button onClick={() => onDateChange(subDays(currentDate, 1))} className="p-2 hover:bg-muted rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                    <span className="font-semibold">{format(currentDate, 'd MMMM yyyy', { locale: tr })}</span>
                    <span className="text-sm text-muted-foreground ml-2">({format(currentDate, 'EEEE', { locale: tr })})</span>
                </div>
                <button onClick={() => onDateChange(addDays(currentDate, 1))} className="p-2 hover:bg-muted rounded-lg">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Slots */}
            <div className="overflow-auto max-h-[calc(100vh-16rem)]">
                <div className="divide-y divide-border/50">
                    {slots.map(slot => {
                        const apt = getAptForSlot(slot);
                        const statusColor = apt && STATUS_COLORS[apt.status];
                        const typeColor = apt?.shootType?.color;
                        const isDragOver = dragOverSlot === slot && !apt;

                        return (
                            <div
                                key={slot}
                                className={cn(
                                    'flex items-center cursor-pointer transition-colors min-h-[48px]',
                                    apt ? (statusColor || 'bg-primary/10') : 'hover:bg-muted/30',
                                    isDragOver && 'bg-primary/20 ring-2 ring-primary/40 ring-inset'
                                )}
                                style={typeColor && !statusColor ? { backgroundColor: `${typeColor}15`, borderLeft: `4px solid ${typeColor}` } : {}}
                                draggable={!!apt}
                                onDragStart={(e) => apt && handleDragStart(e, apt)}
                                onDragOver={(e) => handleDragOver(e, slot)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, slot)}
                                onClick={() => !apt && onSlotClick(dateStr, slot)}
                                onContextMenu={(e) => { if (apt) { e.preventDefault(); onContextMenu(e, apt); } }}
                            >
                                <span className="w-16 px-3 py-3 font-mono text-sm text-muted-foreground border-r border-border text-center shrink-0">{slot}</span>
                                <div className="flex-1 px-3 py-2">
                                    {apt ? (
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium">{apt.fullName || apt.customer?.fullName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {apt.shootType?.name || appointmentTypes.find(t => t.value === apt.appointmentType)?.label}
                                                    {apt.description1 && ` • ${apt.description1}`}
                                                    {apt.studioRoom && ` • ${apt.studioRoom}`}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {(apt.migrated || apt.source === 'archive' || apt.source === 'appointment_migration') && (
                                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-600 border border-orange-500/30">Aktarıldı</span>
                                                )}
                                                {apt.status === 'completed' && <span className="text-xs text-green-600 font-medium">Geldi</span>}
                                                {apt.status === 'no_show' && <span className="text-xs text-red-600 font-medium">Gelmedi</span>}
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-muted-foreground/50">{isDragOver ? 'Buraya bırak' : '— boş —'}</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ==================== ADD/EDIT APPOINTMENT MODAL ====================
function AppointmentModal({ isOpen, onClose, selectedDate, timeSlot, appointment }) {
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
            toast.success('Randevu oluşturuldu');
            onClose();
        },
        onError: () => toast.error('Randevu oluşturulamadı')
    });

    const updateMutation = useMutation({
        mutationFn: (data) => appointmentsApi.update(appointment.id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); toast.success('Randevu güncellendi'); onClose(); },
        onError: () => toast.error('Randevu güncellenemedi')
    });

    const deleteMutation = useMutation({
        mutationFn: () => appointmentsApi.delete(appointment.id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); toast.success('Randevu silindi'); onClose(); },
        onError: () => toast.error('Randevu silinemedi')
    });

    const handleSubmit = (e, forceCreate = false) => {
        e?.preventDefault?.();
        if (!formData.fullName || !formData.phone || !formData.shootTypeId) {
            toast.error('Zorunlu alanları doldurun');
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

                    {/* Conflict Warning */}
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
        return Object.entries(dayData.slots)
            .filter(([_, apt]) => !apt)
            .map(([slot]) => slot);
    }, [dayData]);

    const moveMutation = useMutation({
        mutationFn: () => appointmentsApi.update(appointment.id, { appointmentDate: newDate, timeSlot: newSlot }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); toast.success('Randevu taşındı'); onClose(); },
        onError: () => toast.error('Randevu taşınamadı')
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

// ==================== MAIN COMPONENT ====================
export default function Appointments() {
    const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'day'
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [selectedSlotDate, setSelectedSlotDate] = useState('');
    const [selectedSlotTime, setSelectedSlotTime] = useState('');
    const [editAppointment, setEditAppointment] = useState(null);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [moveAppointment, setMoveAppointment] = useState(null);

    // Context menu
    const [contextMenu, setContextMenu] = useState(null);

    // Postpone
    const [postponeTarget, setPostponeTarget] = useState(null);

    // Delete confirmation
    const [confirmDelete, setConfirmDelete] = useState(null);

    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // Working hours from settings
    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsApi.getAll().then(r => r.data)
    });

    const workingHours = settings?.general?.workingHours || { start: '09:00', end: '19:00' };
    const slots = useMemo(() => generateSlots(workingHours.start, workingHours.end), [workingHours]);

    // Fetch appointments for current range
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const { data: appointmentsData, isLoading } = useQuery({
        queryKey: ['appointments', 'calendar', format(monthStart, 'yyyy-MM-dd'), format(monthEnd, 'yyyy-MM-dd')],
        queryFn: () => appointmentsApi.calendar(
            format(monthStart, 'yyyy-MM-dd'),
            format(monthEnd, 'yyyy-MM-dd')
        ).then(res => res.data || res)
    });

    // Ensure appointments is always an array
    const appointments = Array.isArray(appointmentsData) ? appointmentsData :
        (appointmentsData?.appointments || []);

    // Status mutation
    const statusMutation = useMutation({
        mutationFn: ({ id, status }) => appointmentsApi.updateStatus(id, status),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); toast.success('Durum güncellendi'); }
    });

    // Update mutation (used by postpone)
    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => appointmentsApi.update(id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); }
    });

    // Delete mutation (now invoked by the undoable grace window, not directly by the dialog)
    const deleteMutation = useMutation({
        mutationFn: (id) => appointmentsApi.delete(id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); },
        onError: () => { toast.error('Randevu silinemedi — değişiklikler geri alındı'); queryClient.invalidateQueries({ queryKey: ['appointments'] }); }
    });

    // Undo-capable appointment delete: after Confirm, optimistically remove from cache,
    // show an 8s "Geri Al" toast, and commit the real mutation on expiry.
    const undoableDelete = useUndoable({
        onConfirm: ({ id }) => deleteMutation.mutateAsync(id),
        onUndo: () => {
            // Re-fetch calendar cache to restore the optimistically-removed row.
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
        },
        message: '',
        delayMs: 8000
    });

    const triggerUndoableDelete = (apt) => {
        if (!apt?.id) return;
        const label = apt.fullName || apt.customer?.fullName || 'Randevu';
        // Optimistic cache removal across all appointments queries (month/day/calendar).
        queryClient.setQueriesData({ queryKey: ['appointments'] }, (old) => {
            if (!old) return old;
            if (Array.isArray(old)) return old.filter(x => x.id !== apt.id);
            if (Array.isArray(old.appointments)) return { ...old, appointments: old.appointments.filter(x => x.id !== apt.id) };
            if (Array.isArray(old.data)) return { ...old, data: old.data.filter(x => x.id !== apt.id) };
            return old;
        });
        undoableDelete.trigger({ id: apt.id }, { message: `'${label}' silindi — Geri Al` });
    };

    // Drag-and-drop handler: move appointment to new time slot
    const handleAppointmentDrop = async (appointmentId, newTimeSlot, dateStr) => {
        try {
            await appointmentsApi.update(appointmentId, { timeSlot: newTimeSlot });
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            toast.success('Randevu taşındı');
        } catch (e) {
            console.warn('Operation failed:', e?.message);
            toast.error('Randevu taşınamadı');
        }
    };

    // Slot click → open add modal
    const handleSlotClick = (date, time) => {
        setSelectedSlotDate(date);
        setSelectedSlotTime(time);
        setEditAppointment(null);
        setShowModal(true);
    };

    // Context menu handler
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
                // Navigate to archives page with appointment data pre-populated
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

    // View day from month click
    const handleViewDay = (day) => {
        setCurrentDate(day);
        setViewMode('day');
    };

    // View mode buttons
    const VIEW_MODES = [
        { key: 'month', label: 'Ay', icon: CalendarRange },
        { key: 'week', label: 'Hafta', icon: CalendarDays },
        { key: 'day', label: 'Gün', icon: CalendarCheck }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Randevular</h1>
                    <p className="text-muted-foreground">Randevu takvimi ve yönetimi</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                        {VIEW_MODES.map(mode => (
                            <button
                                key={mode.key}
                                onClick={() => setViewMode(mode.key)}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                                    viewMode === mode.key
                                        ? 'bg-card text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
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

            {/* View Content */}
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
                        onViewDay={handleViewDay}
                    />
                    {/* Selected Day List */}
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

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    appointment={contextMenu.appointment}
                    onClose={() => setContextMenu(null)}
                    onAction={handleContextAction}
                />
            )}

            {/* Add/Edit Modal */}
            <AppointmentModal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setEditAppointment(null); }}
                selectedDate={selectedSlotDate}
                timeSlot={selectedSlotTime}
                appointment={editAppointment}
            />

            {/* Move Modal */}
            <MoveAppointmentModal
                isOpen={showMoveModal}
                onClose={() => { setShowMoveModal(false); setMoveAppointment(null); }}
                appointment={moveAppointment}
            />

            {/* Delete Confirmation — on confirm, hand off to the undoable flow (8s grace). */}
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

            {/* Postpone Modal */}
            {postponeTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPostponeTarget(null)}>
                    <div className="bg-card border border-border rounded-xl p-6 w-96 space-y-4" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold">Randevuyu Ertele</h3>
                        <p className="text-sm text-muted-foreground">
                            {postponeTarget.fullName || postponeTarget.customer?.fullName} — {postponeTarget.timeSlot}
                        </p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Yeni Tarih</label>
                                <input type="date" id="postpone-date"
                                    min={format(new Date(), 'yyyy-MM-dd')}
                                    className="w-full px-3 py-2 rounded-lg bg-background border border-input" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Yeni Saat</label>
                                <select id="postpone-time" className="w-full px-3 py-2 rounded-lg bg-background border border-input">
                                    <option value="">Saat seçin...</option>
                                    {slots.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setPostponeTarget(null)}
                                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">
                                İptal
                            </button>
                            <button onClick={async () => {
                                const newDate = document.getElementById('postpone-date').value;
                                const newTime = document.getElementById('postpone-time').value;
                                if (!newDate || !newTime) { toast.error('Tarih ve saat seçin'); return; }
                                try {
                                    await updateMutation.mutateAsync({ id: postponeTarget.id, data: { appointmentDate: newDate, timeSlot: newTime, status: 'pending' } });
                                    toast.success('Randevu ertelendi');
                                    setPostponeTarget(null);
                                } catch (err) { toast.error('Erteleme başarısız'); }
                            }}
                                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                                Ertele
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

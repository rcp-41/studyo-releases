import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
    format, eachDayOfInterval, isSameDay,
    addDays, subDays, startOfWeek, endOfWeek, addWeeks, subWeeks
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { STATUS_COLORS, appointmentTypes } from './constants';

// ==================== WEEK VIEW ====================
export function WeekView({ appointments, currentDate, onDateChange, slots, onSlotClick, onContextMenu }) {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const [hoveredSlot, setHoveredSlot] = useState(null);
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

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
export function DayView({ appointments, currentDate, onDateChange, slots, onSlotClick, onContextMenu, onDrop }) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const [dragOverSlot, setDragOverSlot] = useState(null);

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

    const getAptForSlot = (slot) => aptSlotMap[slot] || null;

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

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval,
    isSameDay, addMonths, subMonths
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { Clock, Check, XCircle } from 'lucide-react';
import { appointmentTypes } from './constants';

// ==================== MONTH VIEW ====================
export function MonthView({ appointments, selectedDate, onSelectDate, currentMonth, onMonthChange, onViewDay }) {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

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

// ==================== DAY LIST (right panel of month view) ====================
export function DayAppointmentList({ appointments, selectedDate, onStatusMutate }) {
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
                <div key={apt.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
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
                                <button onClick={() => onStatusMutate({ id: apt.id, status: 'completed' })}
                                    className="p-2 text-green-600 hover:bg-green-100 rounded-lg" title="Geldi">
                                    <Check className="w-4 h-4" />
                                </button>
                                <button onClick={() => onStatusMutate({ id: apt.id, status: 'no_show' })}
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
}

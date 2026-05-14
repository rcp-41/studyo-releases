import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { appointmentsApi } from '../../services/api';
import { format, addDays, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Archive } from 'lucide-react';
import { SkeletonTable } from '../Skeleton';
import AppointmentModal from './AppointmentModal';

export default function AppointmentSidebar({ onTransferToArchive }) {
    const { t } = useTranslation();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showModal, setShowModal] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState('');
    const [selectedAppointment, setSelectedAppointment] = useState(null);

    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const { data: dayData, isLoading } = useQuery({
        queryKey: ['appointments', 'day', dateStr],
        queryFn: () => appointmentsApi.getDay(dateStr).then(r => r.data)
    });

    const slots = (() => {
        const result = {};
        for (let h = 8; h <= 20; h++) {
            for (let m = 0; m < 60; m += 30) {
                const slot = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                result[slot] = null;
            }
        }
        const appointments = dayData || [];
        appointments.forEach(apt => {
            const ts = apt.timeSlot;
            if (ts && Object.prototype.hasOwnProperty.call(result, ts)) {
                result[ts] = apt;
            } else if (apt.appointmentDate) {
                const d = new Date(apt.appointmentDate);
                const key = `${String(d.getHours()).padStart(2, '0')}:${String(Math.floor(d.getMinutes() / 30) * 30).padStart(2, '0')}`;
                if (Object.prototype.hasOwnProperty.call(result, key)) result[key] = apt;
            }
        });
        return result;
    })();

    return (
        <div className="bg-card border border-border rounded-xl h-full flex flex-col select-none">
            <div className="flex items-center justify-between p-4 border-b border-border">
                <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="p-2 hover:bg-muted rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                    <input type="date" value={dateStr}
                        onChange={e => setSelectedDate(new Date(e.target.value))}
                        className="bg-transparent text-center font-semibold outline-none cursor-pointer" />
                    <p className="text-sm text-muted-foreground">{format(selectedDate, 'EEEE', { locale: tr })}</p>
                </div>
                <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-2 hover:bg-muted rounded-lg">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="p-3"><SkeletonTable rows={6} columns={2} /></div>
                ) : (
                    <div className="divide-y divide-border">
                        {Object.entries(slots).map(([slot, appointment]) => (
                            <div
                                key={slot}
                                onDoubleClick={() => {
                                    setSelectedSlot(slot);
                                    setSelectedAppointment(appointment || null);
                                    setShowModal(true);
                                }}
                                className={`flex items-center text-sm cursor-pointer transition-colors ${appointment ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}
                            >
                                <span className="w-14 px-2 py-2 font-medium text-muted-foreground border-r border-border text-center">{slot}</span>
                                <div className="flex-1 px-2 py-2 truncate">
                                    {appointment ? (
                                        <span className="font-medium">{appointment.fullName}</span>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </div>
                                {appointment && (
                                    <button
                                        className="p-1 mr-1 rounded hover:bg-primary/20 text-primary/60 hover:text-primary"
                                        title={t('pages.archives.appointmentSidebarLabel')}
                                        onClick={(e) => { e.stopPropagation(); onTransferToArchive?.(appointment); }}
                                    >
                                        <Archive className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <AppointmentModal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setSelectedAppointment(null); }}
                date={dateStr}
                timeSlot={selectedSlot}
                appointment={selectedAppointment}
            />
        </div>
    );
}

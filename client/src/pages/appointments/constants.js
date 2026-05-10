export const appointmentTypes = [
    { value: 'consultation', label: 'Görüşme' },
    { value: 'shoot', label: 'Çekim' },
    { value: 'delivery', label: 'Teslim' },
    { value: 'payment', label: 'Ödeme' },
    { value: 'other', label: 'Diğer' }
];

export const STATUS_COLORS = {
    completed: 'bg-green-500/20 border-green-500/40 text-green-600',
    no_show: 'bg-red-500/20 border-red-500/40 text-red-600'
};

export function generateSlots(start = '09:00', end = '19:00') {
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

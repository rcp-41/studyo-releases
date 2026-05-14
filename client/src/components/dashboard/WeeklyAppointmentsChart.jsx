import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function WeeklyAppointmentsChart({ summary }) {
    const { t } = useTranslation();
    const days = [t('appointmentsPage.month').substring(0, 3), 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const weeklyData = summary?.weeklyAppointments || days.map(d => ({ day: d, count: 0 }));

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">{t('appointmentsPage.week')} {t('appointmentsPage.title')}</h2>
            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                        <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} allowDecimals={false} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                            }}
                            formatter={(value) => [value, t('appointmentsPage.title')]}
                        />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

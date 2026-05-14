import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function ShootTypePie({ shootTypePieData, dateRangeLabel }) {
    const { t } = useTranslation();

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{t('shoots.shootTypes')}</h2>
                <span className="text-sm text-muted-foreground">{dateRangeLabel}</span>
            </div>
            <div className="h-52 flex items-center justify-center">
                {shootTypePieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={shootTypePieData}
                                dataKey="count"
                                nameKey="type"
                                cx="50%"
                                cy="50%"
                                outerRadius={70}
                                label={({ type, count }) => `${type}: ${count}`}
                            >
                                {shootTypePieData.map((_, index) => (
                                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value, name) => [value, name]} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="text-muted-foreground">{t('common.noData')}</div>
                )}
            </div>
        </div>
    );
}

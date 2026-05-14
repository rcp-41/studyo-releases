import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
    Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ComposedChart
} from 'recharts';

export default function RevenueChart({ chartData, dateRange, dateRangeLabel, isLoading }) {
    const { t } = useTranslation();

    return (
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{t('pages.finance.revenue')} {t('components.templateEditor.variables')}</h2>
                <span className="text-sm text-muted-foreground">{dateRangeLabel}</span>
            </div>
            <div className="h-64">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="date"
                                stroke="hsl(var(--muted-foreground))"
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value) => dateRange === 'today' ? value : (value.split('-')[2] || value)}
                            />
                            <YAxis
                                yAxisId="revenue"
                                orientation="left"
                                stroke="#10b981"
                                tick={{ fontSize: 11 }}
                                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                            />
                            <YAxis
                                yAxisId="customers"
                                orientation="right"
                                stroke="#3b82f6"
                                tick={{ fontSize: 11 }}
                                allowDecimals={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px'
                                }}
                                formatter={(value, name) => [
                                    name === 'revenue' ? `${value.toLocaleString('tr-TR')} ₺` : value,
                                    name === 'revenue' ? t('pages.finance.revenue') : t('pages.customers.title')
                                ]}
                            />
                            <Area
                                yAxisId="revenue"
                                type="monotone"
                                dataKey="revenue"
                                stroke="#10b981"
                                fill="rgba(16, 185, 129, 0.15)"
                                name="revenue"
                            />
                            <Line
                                yAxisId="customers"
                                type="monotone"
                                dataKey="customers"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={{ r: 3, fill: '#3b82f6' }}
                                name="customers"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : t('common.noData')}
                    </div>
                )}
            </div>
        </div>
    );
}

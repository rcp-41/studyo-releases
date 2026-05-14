import { TrendingUp } from 'lucide-react';

const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    purple: 'bg-purple-500/10 text-purple-500',
    amber: 'bg-amber-500/10 text-amber-500'
};

export function SummaryCard({ title, value, subtitle, icon: Icon, trend, color }) {
    return (
        <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-muted-foreground">{title}</p>
                    <p className="text-3xl font-bold mt-1">{value}</p>
                    {subtitle && (
                        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                    )}
                </div>
                <div className={`p-3 rounded-lg ${colorClasses[color] || colorClasses.blue}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
            {trend && (
                <div className="flex items-center gap-1 mt-4 text-sm text-green-500">
                    <TrendingUp className="w-4 h-4" />
                    <span>{trend}</span>
                </div>
            )}
        </div>
    );
}

export default SummaryCard;

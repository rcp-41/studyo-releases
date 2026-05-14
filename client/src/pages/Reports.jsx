import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import {
    BarChart3, TrendingUp, Camera, Users, Share2, AlertTriangle, Calendar
} from 'lucide-react';

import IncomeReport from '../components/reports/IncomeReport';
import ShootTypeReport from '../components/reports/ShootTypeReport';
import PhotographerReport from '../components/reports/PhotographerReport';
import SourceReport from '../components/reports/SourceReport';
import OverdueReport from '../components/reports/OverdueReport';

function getTabs(t) {
    return [
        { key: 'income', label: t('pages.reports.income'), icon: TrendingUp },
        { key: 'shootType', label: t('pages.reports.shootType'), icon: Camera },
        { key: 'photographer', label: t('pages.reports.photographer'), icon: Users },
        { key: 'source', label: t('pages.reports.source'), icon: Share2 },
        { key: 'overdue', label: t('pages.reports.overdue'), icon: AlertTriangle }
    ];
}

export default function Reports() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('income');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const tabs = getTabs(t);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <BarChart3 className="w-7 h-7" /> {t('pages.reports.title')}
                </h1>
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                        className="px-2 py-1.5 text-sm rounded-lg bg-background border border-input outline-none" />
                    <span className="text-muted-foreground">—</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                        className="px-2 py-1.5 text-sm rounded-lg bg-background border border-input outline-none" />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                                activeTab === tab.key
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            )}>
                            <Icon className="w-4 h-4" /> {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            {activeTab === 'income' && <IncomeReport startDate={startDate} endDate={endDate} />}
            {activeTab === 'shootType' && <ShootTypeReport startDate={startDate} endDate={endDate} />}
            {activeTab === 'photographer' && <PhotographerReport startDate={startDate} endDate={endDate} />}
            {activeTab === 'source' && <SourceReport startDate={startDate} endDate={endDate} />}
            {activeTab === 'overdue' && <OverdueReport />}
        </div>
    );
}

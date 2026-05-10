import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import {
    DollarSign, Wallet, TrendingDown, AlertTriangle, LayoutDashboard
} from 'lucide-react';

import DashboardTab from './finance/DashboardTab';
import PaymentsTab from './finance/PaymentsTab';
import CashTab from './finance/CashTab';
import ExpensesTab from './finance/ExpensesTab';
import OverdueTab from './finance/OverdueTab';

export default function Finance() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [range, setRange] = useState('month');

    const tabs = [
        { key: 'dashboard', label: t('pages.finance.dashboard'), icon: LayoutDashboard },
        { key: 'payments', label: t('pages.finance.payments'), icon: DollarSign },
        { key: 'cash', label: t('pages.finance.cash'), icon: Wallet },
        { key: 'expenses', label: t('pages.finance.expenses'), icon: TrendingDown },
        { key: 'overdue', label: t('pages.finance.overdue'), icon: AlertTriangle }
    ];

    const dateRanges = [
        { key: 'today', label: t('pages.finance.today') },
        { key: 'week', label: t('pages.finance.week') },
        { key: 'month', label: t('pages.finance.month') }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <DollarSign className="w-7 h-7" /> {t('pages.finance.title')}
                </h1>
                <div className="flex bg-muted rounded-lg p-1">
                    {dateRanges.map(r => (
                        <button key={r.key} onClick={() => setRange(r.key)}
                            className={cn('px-4 py-1.5 text-sm rounded-md transition-colors',
                                range === r.key ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

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

            {activeTab === 'dashboard' && <DashboardTab range={range} />}
            {activeTab === 'payments' && <PaymentsTab range={range} />}
            {activeTab === 'cash' && <CashTab />}
            {activeTab === 'expenses' && <ExpensesTab range={range} />}
            {activeTab === 'overdue' && <OverdueTab />}
        </div>
    );
}

import { useTranslation } from 'react-i18next';
import { UserX } from 'lucide-react';

export default function PersonnelSection({ summary }) {
    const { t } = useTranslation();
    const leaves = summary?.personnelLeaves || [];

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <UserX className="w-5 h-5 text-muted-foreground" />
                {t('users.leaveType')} {t('auth.staff')}
            </h2>
            {leaves.length > 0 ? (
                <div className="space-y-3">
                    {leaves.map((leave, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 text-sm font-medium">
                                    {leave.name?.charAt(0) || '?'}
                                </div>
                                <div>
                                    <p className="font-medium text-sm">{leave.name}</p>
                                    <p className="text-xs text-muted-foreground">{leave.reason || t('users.leaveType')}</p>
                                </div>
                            </div>
                            <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-600 font-medium">
                                {leave.day || t('pages.cashRegister.daily')}
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-center py-6 text-muted-foreground text-sm">
                    {t('appointmentsPage.week')} {t('users.leaveType').toLowerCase()} {t('auth.staff')} {t('common.none').toLowerCase()}
                </p>
            )}
        </div>
    );
}

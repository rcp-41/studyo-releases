import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { botApi } from '../../services/api';
import { Bot, MessageSquare, Phone, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function BotStatusAlert() {
    const { t } = useTranslation();

    const { data: botStatus } = useQuery({
        queryKey: ['bot', 'status'],
        queryFn: async () => {
            try {
                const res = await botApi.getStatus();
                return res?.data || res || null;
            } catch { return null; }
        },
        retry: false,
        staleTime: 120_000
    });

    if (!botStatus) return null;

    const waEnabled = botStatus?.whatsapp?.enabled;
    const voiceEnabled = botStatus?.voice?.enabled;
    if (!waEnabled && !voiceEnabled) return null;

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Bot className="w-5 h-5 text-purple-500" />
                    AI Bot {t('pages.botConversations.title')}
                </h2>
                <Link
                    to="/bot-conversations"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                    {t('pages.botConversations.title')} <ChevronRight className="w-4 h-4" />
                </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-lg flex items-center gap-3 ${waEnabled ? 'bg-green-500/5' : 'bg-muted/50'}`}>
                    <div className={`p-2 rounded-lg ${waEnabled ? 'bg-green-500/10' : 'bg-muted'}`}>
                        <MessageSquare className={`w-5 h-5 ${waEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                        <p className="font-medium text-sm">WhatsApp</p>
                        <p className="text-xs text-muted-foreground">
                            {waEnabled ? '✅ ' + t('settingsPage.autoOn').split(' ')[2] : '❌ ' + t('settingsPage.autoOff').split(' ')[3]}
                            {botStatus?.whatsapp?.messageCount ? ` · ${botStatus.whatsapp.messageCount} ${t('pages.botConversations.messages')}` : ''}
                        </p>
                    </div>
                </div>
                <div className={`p-3 rounded-lg flex items-center gap-3 ${voiceEnabled ? 'bg-purple-500/5' : 'bg-muted/50'}`}>
                    <div className={`p-2 rounded-lg ${voiceEnabled ? 'bg-purple-500/10' : 'bg-muted'}`}>
                        <Phone className={`w-5 h-5 ${voiceEnabled ? 'text-purple-500' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                        <p className="font-medium text-sm">{t('settingsPage.reminderHours').split(' ')[0]} Bot</p>
                        <p className="text-xs text-muted-foreground">
                            {voiceEnabled ? '✅ ' + t('settingsPage.autoOn').split(' ')[2] : '❌ ' + t('settingsPage.autoOff').split(' ')[3]}
                            {botStatus?.voice?.callCount ? ` · ${botStatus.voice.callCount} ${t('components.templateEditor.variables')}` : ''}
                        </p>
                    </div>
                </div>
            </div>
            {botStatus?.stats && (
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
                    <span>{t('pages.dashboard.todayAppointments').split('Bugün')[0]}: {botStatus.stats.todayMessages || 0} {t('pages.botConversations.messages')}</span>
                    <span>{botStatus.stats.todayAppointments || 0} {t('appointmentsPage.title').toLowerCase()} · {botStatus.stats.todayComplaints || 0} {t('common.warning').toLowerCase()}</span>
                </div>
            )}
        </div>
    );
}

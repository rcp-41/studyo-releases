/**
 * SupportTicket Page — /support
 * Kullanıcı destek talebi açar, listeler ve cevap yazar.
 * Backend callable: setup-createTicket, setup-listTickets, setup-replyTicket
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import useAuthStore from '../store/authStore';
import { cn } from '../lib/utils';
import { Send, ChevronLeft, Plus, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import notify from '../lib/notify';

const PRIORITY_OPTIONS = ['low', 'medium', 'high'];

function TicketBadge({ status }) {
    const { t } = useTranslation();
    const styles = {
        open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
        pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
        resolved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
        closed: 'bg-muted text-muted-foreground',
    };
    return (
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', styles[status] || styles.open)}>
            {t(`support.status.${status}`, status)}
        </span>
    );
}

function PriorityBadge({ priority }) {
    const { t } = useTranslation();
    const styles = {
        low: 'text-muted-foreground',
        medium: 'text-yellow-600 dark:text-yellow-400',
        high: 'text-red-600 dark:text-red-400',
    };
    return (
        <span className={cn('text-xs font-medium', styles[priority])}>
            {t(`support.priority.${priority}`, priority)}
        </span>
    );
}

export default function SupportTicket() {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);

    const [view, setView] = useState('list'); // 'list' | 'new' | 'detail'
    const [tickets, setTickets] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [listLoading, setListLoading] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [replySending, setReplySending] = useState(false);
    const [form, setForm] = useState({ subject: '', priority: 'medium', body: '' });
    const [formErrors, setFormErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const messagesEndRef = useRef(null);

    const listTickets = async () => {
        setListLoading(true);
        try {
            const fn = httpsCallable(functions, 'setup-listTickets');
            const result = await fn({ studioId: user?.studioId });
            setTickets(result.data?.tickets || []);
        } catch (err) {
            console.error('[SupportTicket] listTickets error:', err);
            notify.error(t('support.listError'));
        } finally {
            setListLoading(false);
        }
    };

    useEffect(() => {
        listTickets();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (view === 'detail' && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [view, selectedTicket?.messages]);

    const validateForm = () => {
        const errors = {};
        if (!form.subject.trim()) errors.subject = t('support.validation.subjectRequired');
        if (!form.body.trim()) errors.body = t('support.validation.bodyRequired');
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setSubmitting(true);
        try {
            const fn = httpsCallable(functions, 'setup-createTicket');
            await fn({
                studioId: user?.studioId,
                subject: form.subject.trim(),
                priority: form.priority,
                body: form.body.trim(),
            });
            notify.success(t('support.createSuccess'));
            setForm({ subject: '', priority: 'medium', body: '' });
            setFormErrors({});
            setView('list');
            await listTickets();
        } catch (err) {
            console.error('[SupportTicket] createTicket error:', err);
            notify.error(t('support.createError'));
        } finally {
            setSubmitting(false);
        }
    };

    const openTicket = async (ticket) => {
        setSelectedTicket(ticket);
        setView('detail');
        setReplyText('');
    };

    const handleReply = async (e) => {
        e.preventDefault();
        if (!replyText.trim()) return;
        setReplySending(true);
        try {
            const fn = httpsCallable(functions, 'setup-replyTicket');
            const result = await fn({
                ticketId: selectedTicket.id,
                message: replyText.trim(),
            });
            setReplyText('');
            const updatedTicket = result.data?.ticket || {
                ...selectedTicket,
                messages: [
                    ...(selectedTicket.messages || []),
                    { role: 'user', text: replyText.trim(), ts: Date.now() }
                ]
            };
            setSelectedTicket(updatedTicket);
        } catch (err) {
            console.error('[SupportTicket] replyTicket error:', err);
            notify.error(t('support.replyError'));
        } finally {
            setReplySending(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {view !== 'list' && (
                        <button
                            onClick={() => { setView('list'); setSelectedTicket(null); }}
                            className="p-1.5 hover:bg-muted rounded-lg"
                            aria-label={t('common.back')}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    )}
                    <h1 className="text-xl font-semibold">
                        {view === 'list' && t('support.title')}
                        {view === 'new' && t('support.newTicket')}
                        {view === 'detail' && selectedTicket?.subject}
                    </h1>
                </div>
                {view === 'list' && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={listTickets}
                            className="p-2 hover:bg-muted rounded-lg"
                            aria-label={t('common.refresh')}
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setView('new')}
                            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                        >
                            <Plus className="w-4 h-4" />
                            {t('support.newTicket')}
                        </button>
                    </div>
                )}
            </div>

            {/* LIST VIEW */}
            {view === 'list' && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    {listLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                            <AlertCircle className="w-8 h-8" />
                            <p className="text-sm">{t('support.noTickets')}</p>
                        </div>
                    ) : (
                        <ul>
                            {tickets.map((ticket, i) => (
                                <li key={ticket.id}>
                                    <button
                                        onClick={() => openTicket(ticket)}
                                        className={cn(
                                            'w-full text-left px-4 py-3 hover:bg-muted transition-colors',
                                            i !== 0 && 'border-t border-border'
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium text-sm truncate">{ticket.subject}</span>
                                            <TicketBadge status={ticket.status} />
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <PriorityBadge priority={ticket.priority} />
                                            <span className="text-xs text-muted-foreground">
                                                {ticket.createdAt
                                                    ? new Date(ticket.createdAt._seconds
                                                        ? ticket.createdAt._seconds * 1000
                                                        : ticket.createdAt).toLocaleDateString()
                                                    : ''}
                                            </span>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* NEW TICKET VIEW */}
            {view === 'new' && (
                <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 space-y-4" noValidate>
                    <div>
                        <label htmlFor="ticket-subject" className="block text-sm font-medium mb-1">
                            {t('support.form.subject')} <span className="text-destructive">*</span>
                        </label>
                        <input
                            id="ticket-subject"
                            type="text"
                            value={form.subject}
                            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                            className={cn(
                                'w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50',
                                formErrors.subject ? 'border-destructive' : 'border-border'
                            )}
                            placeholder={t('support.form.subjectPlaceholder')}
                            aria-describedby={formErrors.subject ? 'subject-error' : undefined}
                        />
                        {formErrors.subject && (
                            <p id="subject-error" className="text-xs text-destructive mt-1">{formErrors.subject}</p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="ticket-priority" className="block text-sm font-medium mb-1">
                            {t('support.form.priority')}
                        </label>
                        <select
                            id="ticket-priority"
                            value={form.priority}
                            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                            {PRIORITY_OPTIONS.map((p) => (
                                <option key={p} value={p}>{t(`support.priority.${p}`)}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="ticket-body" className="block text-sm font-medium mb-1">
                            {t('support.form.body')} <span className="text-destructive">*</span>
                        </label>
                        <textarea
                            id="ticket-body"
                            value={form.body}
                            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                            rows={5}
                            className={cn(
                                'w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y',
                                formErrors.body ? 'border-destructive' : 'border-border'
                            )}
                            placeholder={t('support.form.bodyPlaceholder')}
                            aria-describedby={formErrors.body ? 'body-error' : undefined}
                        />
                        {formErrors.body && (
                            <p id="body-error" className="text-xs text-destructive mt-1">{formErrors.body}</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => { setView('list'); setFormErrors({}); }}
                            className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
                        >
                            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            {t('support.form.submit')}
                        </button>
                    </div>
                </form>
            )}

            {/* DETAIL VIEW */}
            {view === 'detail' && selectedTicket && (
                <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col" style={{ minHeight: 400 }}>
                    <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                        <TicketBadge status={selectedTicket.status} />
                        <PriorityBadge priority={selectedTicket.priority} />
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 420 }}>
                        {(selectedTicket.messages || []).map((msg, i) => (
                            <div
                                key={i}
                                className={cn(
                                    'max-w-[75%] px-3 py-2 rounded-xl text-sm',
                                    msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground ml-auto'
                                        : 'bg-muted text-foreground mr-auto'
                                )}
                            >
                                <p>{msg.text}</p>
                                {msg.ts && (
                                    <p className={cn('text-[10px] mt-1 opacity-60', msg.role === 'user' ? 'text-right' : '')}>
                                        {new Date(msg.ts).toLocaleTimeString()}
                                    </p>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' && (
                        <form onSubmit={handleReply} className="px-4 py-3 border-t border-border flex items-end gap-2">
                            <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                rows={2}
                                placeholder={t('support.replyPlaceholder')}
                                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                aria-label={t('support.replyPlaceholder')}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleReply(e);
                                    }
                                }}
                            />
                            <button
                                type="submit"
                                disabled={replySending || !replyText.trim()}
                                className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                                aria-label={t('support.send')}
                            >
                                {replySending
                                    ? <Loader2 className="w-5 h-5 animate-spin" />
                                    : <Send className="w-5 h-5" />
                                }
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}

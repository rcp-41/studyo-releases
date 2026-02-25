import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi, appointmentsApi } from '../services/api';
import { formatDate, formatCurrency, getStatusLabel, getShootTypeLabel, getInitials, cn } from '../lib/utils';
import {
    ArrowLeft, Phone, Mail, MapPin, Star, Camera, DollarSign,
    Calendar, Edit, Loader2, MessageCircle, X, Clock,
    CreditCard, Banknote, ArrowRightLeft, FileText, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

// ==================== ACTIVITY TIMELINE ====================
const ACTIVITY_ICONS = {
    appointment: { icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    payment: { icon: DollarSign, color: 'text-green-500', bg: 'bg-green-500/10' },
    shoot: { icon: Camera, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    whatsapp: { icon: MessageCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    note: { icon: FileText, color: 'text-gray-500', bg: 'bg-gray-500/10' },
    status_change: { icon: RefreshCw, color: 'text-orange-500', bg: 'bg-orange-500/10' }
};

function ActivityTimeline({ shoots, appointments }) {
    const events = useMemo(() => {
        const items = [];

        // Shoots → events
        shoots?.forEach(s => {
            items.push({
                type: 'shoot',
                date: s.shootDate || s.createdAt,
                title: `${getShootTypeLabel(s.shootType)} çekimi`,
                desc: s.shootCode + (s.location?.name ? ` - ${s.location.name}` : ''),
                amount: s.totalAmount
            });
            // Payment events from shoot
            if (s.cashAmount > 0) items.push({ type: 'payment', date: s.createdAt, title: 'Nakit ödeme', desc: s.shootCode, amount: s.cashAmount });
            if (s.cardAmount > 0) items.push({ type: 'payment', date: s.createdAt, title: 'Kart ödeme', desc: s.shootCode, amount: s.cardAmount });
            if (s.transferAmount > 0) items.push({ type: 'payment', date: s.createdAt, title: 'Havale/EFT ödeme', desc: s.shootCode, amount: s.transferAmount });
        });

        // Appointments → events
        appointments?.forEach(a => {
            items.push({
                type: 'appointment',
                date: a.appointmentDate,
                title: `Randevu - ${a.timeSlot || ''}`,
                desc: a.shootType?.name || a.appointmentType || '',
                status: a.status
            });
        });

        // Sort by date desc
        items.sort((a, b) => new Date(b.date) - new Date(a.date));
        return items;
    }, [shoots, appointments]);

    if (events.length === 0) {
        return <p className="text-center py-6 text-muted-foreground">Henüz aktivite yok</p>;
    }

    return (
        <div className="relative space-y-0">
            {/* Timeline line */}
            <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

            {events.map((event, i) => {
                const config = ACTIVITY_ICONS[event.type] || ACTIVITY_ICONS.note;
                const Icon = config.icon;
                return (
                    <div key={i} className="relative flex items-start gap-3 py-2 pl-1">
                        <div className={cn('relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0', config.bg)}>
                            <Icon className={cn('w-4 h-4', config.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{event.title}</span>
                                {event.amount > 0 && (
                                    <span className="text-xs text-green-600 font-medium">{formatCurrency(event.amount)}</span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">{event.desc}</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                {event.date ? format(new Date(event.date), 'dd.MM.yyyy HH:mm', { locale: tr }) : '-'}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ==================== PAYMENT HISTORY TABLE ====================
function PaymentHistory({ shoots }) {
    if (!shoots?.length) {
        return <p className="text-center py-6 text-muted-foreground">Ödeme geçmişi yok</p>;
    }

    const totals = shoots.reduce((acc, s) => {
        acc.total += s.totalAmount || 0;
        acc.cash += s.cashAmount || 0;
        acc.card += s.cardAmount || 0;
        acc.transfer += s.transferAmount || 0;
        return acc;
    }, { total: 0, cash: 0, card: 0, transfer: 0 });
    totals.paid = totals.cash + totals.card + totals.transfer;
    totals.remaining = totals.total - totals.paid;

    return (
        <div className="overflow-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-border text-left">
                        <th className="px-3 py-2 font-medium">Tarih</th>
                        <th className="px-3 py-2 font-medium">Çekim Türü</th>
                        <th className="px-3 py-2 font-medium text-right">Toplam</th>
                        <th className="px-3 py-2 font-medium text-right">Ödenen</th>
                        <th className="px-3 py-2 font-medium text-right">Kalan</th>
                    </tr>
                </thead>
                <tbody>
                    {shoots.map((s) => {
                        const paid = (s.cashAmount || 0) + (s.cardAmount || 0) + (s.transferAmount || 0);
                        const remaining = (s.totalAmount || 0) - paid;
                        return (
                            <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                                <td className="px-3 py-2">{formatDate(s.shootDate || s.createdAt)}</td>
                                <td className="px-3 py-2">{getShootTypeLabel(s.shootType)}</td>
                                <td className="px-3 py-2 text-right font-mono">{formatCurrency(s.totalAmount || 0)}</td>
                                <td className="px-3 py-2 text-right font-mono text-green-600">{formatCurrency(paid)}</td>
                                <td className={cn('px-3 py-2 text-right font-mono', remaining > 0 ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
                                    {formatCurrency(remaining)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-border font-semibold">
                        <td colSpan={2} className="px-3 py-2 text-right">TOPLAM</td>
                        <td className="px-3 py-2 text-right font-mono">{formatCurrency(totals.total)}</td>
                        <td className="px-3 py-2 text-right font-mono text-green-600">{formatCurrency(totals.paid)}</td>
                        <td className={cn('px-3 py-2 text-right font-mono', totals.remaining > 0 ? 'text-red-500' : 'text-muted-foreground')}>
                            {formatCurrency(totals.remaining)}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

// ==================== APPOINTMENT HISTORY ====================
function AppointmentHistory({ appointments }) {
    if (!appointments?.length) {
        return <p className="text-center py-6 text-muted-foreground">Randevu geçmişi yok</p>;
    }

    const statusMap = {
        pending: { label: 'Beklemede', color: 'bg-yellow-500/15 text-yellow-600' },
        confirmed: { label: 'Onaylandı', color: 'bg-blue-500/15 text-blue-600' },
        completed: { label: 'Tamamlandı', color: 'bg-green-500/15 text-green-600' },
        cancelled: { label: 'İptal', color: 'bg-red-500/15 text-red-600' },
        no_show: { label: 'Gelmedi', color: 'bg-red-500/15 text-red-600' }
    };

    return (
        <div className="space-y-2">
            {appointments.map((apt) => {
                const st = statusMap[apt.status] || statusMap.pending;
                return (
                    <div key={apt.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                    {apt.appointmentDate ? format(new Date(apt.appointmentDate), 'dd.MM.yyyy', { locale: tr }) : '-'}
                                </span>
                                <span className="text-sm text-muted-foreground">{apt.timeSlot || ''}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{apt.shootType?.name || apt.appointmentType || ''}</p>
                        </div>
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded', st.color)}>{st.label}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ==================== MAIN COMPONENT ====================
export default function CustomerDetail() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const [showEdit, setShowEdit] = useState(false);
    const [activeTab, setActiveTab] = useState('overview'); // overview | payments | appointments | timeline
    const queryClient = useQueryClient();

    // If coming from phone lookup (e.g. from Archives)
    const lookupPhone = searchParams.get('phone');
    const lookupName = searchParams.get('name');

    // Fetch customer by ID or search by phone
    const { data: customer, isLoading } = useQuery({
        queryKey: ['customer', id || `phone-${lookupPhone}`],
        queryFn: async () => {
            if (id) return customersApi.get(id).then(res => res.data);
            if (lookupPhone) {
                const res = await customersApi.search(lookupPhone);
                return res.data?.[0] || null;
            }
            return null;
        }
    });

    const { data: shoots } = useQuery({
        queryKey: ['customer', customer?.id, 'shoots'],
        queryFn: () => customersApi.getShoots(customer.id).then(res => res.data),
        enabled: !!customer?.id
    });

    // Fetch appointments by phone (for appointment history)
    const { data: appointments } = useQuery({
        queryKey: ['customer-appointments', customer?.phone],
        queryFn: () => appointmentsApi.calendar('2020-01-01', '2030-12-31').then(res => {
            const phone = customer.phone?.replace(/[^0-9]/g, '');
            return res.data?.filter(a => a.phone?.replace(/[^0-9]/g, '')?.includes(phone)) || [];
        }),
        enabled: !!customer?.phone
    });

    const handleWhatsApp = () => {
        if (!customer?.phone) { toast.error('Telefon numarası bulunamadı'); return; }
        const phone = customer.phone.replace(/[^0-9]/g, '');
        const formatted = phone.startsWith('0') ? '90' + phone.slice(1) : phone;
        window.open(`https://wa.me/${formatted}`, '_blank');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="text-center py-12 space-y-4">
                <p className="text-lg">Müşteri bulunamadı</p>
                {lookupName && <p className="text-muted-foreground">"{decodeURIComponent(lookupName)}" için kayıt yok</p>}
                <Link to="/customers" className="text-primary hover:underline">Müşterilere dön</Link>
            </div>
        );
    }

    // Tab definitions
    const TABS = [
        { key: 'overview', label: 'Genel Bakış', icon: Camera },
        { key: 'payments', label: 'Ödeme Geçmişi', icon: DollarSign },
        { key: 'appointments', label: 'Randevular', icon: Calendar },
        { key: 'timeline', label: 'Aktivite', icon: Clock }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/customers" className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold">{customer.fullName}</h1>
                            {customer.isVip && <Star className="w-5 h-5 fill-amber-400 text-amber-400" />}
                        </div>
                        <p className="text-muted-foreground">{customer.customerCode}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleWhatsApp} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted">
                        <MessageCircle className="w-4 h-4" /> Mesaj Gönder
                    </button>
                    <button onClick={() => setShowEdit(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                        <Edit className="w-4 h-4" /> Düzenle
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Contact Info Card */}
                <div className="bg-card border border-border rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">İletişim Bilgileri</h2>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-semibold">
                            {getInitials(customer.fullName)}
                        </div>
                        <div>
                            <p className="font-medium">{customer.fullName}</p>
                            <p className="text-sm text-muted-foreground capitalize">
                                {customer.customerType === 'corporate' ? 'Kurumsal' : 'Bireysel'}
                            </p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {customer.phone && (
                            <div className="flex items-center gap-3">
                                <Phone className="w-5 h-5 text-muted-foreground" />
                                <a href={`tel:${customer.phone}`} className="hover:text-primary">{customer.phone}</a>
                            </div>
                        )}
                        {customer.email && (
                            <div className="flex items-center gap-3">
                                <Mail className="w-5 h-5 text-muted-foreground" />
                                <a href={`mailto:${customer.email}`} className="hover:text-primary">{customer.email}</a>
                            </div>
                        )}
                        {customer.address && (
                            <div className="flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                                <span>{customer.address}</span>
                            </div>
                        )}
                    </div>
                    {customer.notes && (
                        <div className="mt-6 pt-6 border-t border-border">
                            <h3 className="text-sm font-medium mb-2">Notlar</h3>
                            <p className="text-sm text-muted-foreground">{customer.notes}</p>
                        </div>
                    )}
                </div>

                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-blue-500/10"><Camera className="w-4 h-4 text-blue-500" /></div>
                                <span className="text-xs text-muted-foreground">Çekim</span>
                            </div>
                            <p className="text-xl font-bold">{shoots?.length || 0}</p>
                        </div>
                        <div className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-green-500/10"><DollarSign className="w-4 h-4 text-green-500" /></div>
                                <span className="text-xs text-muted-foreground">Toplam</span>
                            </div>
                            <p className="text-xl font-bold">{formatCurrency(shoots?.reduce((s, x) => s + (x.totalAmount || 0), 0) || 0)}</p>
                        </div>
                        <div className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-emerald-500/10"><CreditCard className="w-4 h-4 text-emerald-500" /></div>
                                <span className="text-xs text-muted-foreground">Ödenen</span>
                            </div>
                            <p className="text-xl font-bold text-green-600">
                                {formatCurrency(shoots?.reduce((s, x) => s + (x.cashAmount || 0) + (x.cardAmount || 0) + (x.transferAmount || 0), 0) || 0)}
                            </p>
                        </div>
                        <div className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-purple-500/10"><Calendar className="w-4 h-4 text-purple-500" /></div>
                                <span className="text-xs text-muted-foreground">Randevu</span>
                            </div>
                            <p className="text-xl font-bold">{appointments?.length || 0}</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                        <div className="flex border-b border-border">
                            {TABS.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={cn(
                                        'flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2',
                                        activeTab === tab.key
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-6">
                            {/* Overview - Shoots list */}
                            {activeTab === 'overview' && (
                                <>
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-lg font-semibold">Çekimler</h2>
                                        {shoots?.length > 5 && (
                                            <Link to={`/shoots?customerId=${customer.id}`} className="text-sm text-primary hover:underline">
                                                Tümünü Gör
                                            </Link>
                                        )}
                                    </div>
                                    {shoots?.length ? (
                                        <div className="space-y-3">
                                            {shoots.slice(0, 5).map((shoot) => (
                                                <Link key={shoot.id} to={`/shoots/${shoot.id}`}
                                                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                                                    <div>
                                                        <p className="font-medium">{shoot.shootCode}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {getShootTypeLabel(shoot.shootType)} • {formatDate(shoot.shootDate)}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`px-2 py-1 rounded text-xs font-medium status-${shoot.status}`}>
                                                            {getStatusLabel(shoot.status)}
                                                        </span>
                                                        <p className="text-sm mt-1">{formatCurrency(shoot.totalAmount)}</p>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-center py-6 text-muted-foreground">Henüz çekim kaydı yok</p>
                                    )}
                                </>
                            )}

                            {/* Payment History */}
                            {activeTab === 'payments' && <PaymentHistory shoots={shoots} />}

                            {/* Appointment History */}
                            {activeTab === 'appointments' && <AppointmentHistory appointments={appointments} />}

                            {/* Activity Timeline */}
                            {activeTab === 'timeline' && <ActivityTimeline shoots={shoots} appointments={appointments} />}
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {showEdit && (
                <EditCustomerModal
                    customer={customer}
                    onClose={() => setShowEdit(false)}
                    onSave={() => { queryClient.invalidateQueries({ queryKey: ['customer'] }); setShowEdit(false); }}
                />
            )}
        </div>
    );
}

// ==================== EDIT CUSTOMER MODAL ====================
function EditCustomerModal({ customer, onClose, onSave }) {
    const [formData, setFormData] = useState({
        fullName: customer.fullName || '',
        phone: customer.phone || '',
        email: customer.email || '',
        customerType: customer.customerType || 'individual',
        isVip: customer.isVip || false,
        notes: customer.notes || '',
        address: customer.address || ''
    });

    const updateMutation = useMutation({
        mutationFn: (data) => customersApi.update(customer.id, data),
        onSuccess: () => { toast.success('Müşteri güncellendi'); onSave(); },
        onError: () => toast.error('Güncelleme başarısız')
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        updateMutation.mutate(formData);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Müşteri Düzenle</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Ad Soyad</label>
                        <input type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Telefon</label>
                        <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">E-posta</label>
                        <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Adres</label>
                        <textarea value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none resize-none" rows={2} />
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="editVip" checked={formData.isVip}
                            onChange={e => setFormData({ ...formData, isVip: e.target.checked })} className="w-4 h-4" />
                        <label htmlFor="editVip" className="text-sm">VIP Müşteri</label>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Notlar</label>
                        <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none resize-none" rows={2} />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">İptal</button>
                        <button type="submit" disabled={updateMutation.isPending}
                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                            {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Güncelle
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

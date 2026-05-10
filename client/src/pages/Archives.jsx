/**
 * Archives — Orchestrator (refactored)
 * Alt-bileşenler: ArchiveDetailModal, ArchiveFilters, ArchiveList
 * Appointment sidebar inline (küçük, mevcut tasarımı korur)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { archivesApi, appointmentsApi, optionsApi, settingsApi, schoolsApi, whatsappApi } from '../services/api';
import { format, addDays, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
    Plus, Search, ChevronLeft, ChevronRight, X, Loader2,
    MessageCircle, ExternalLink, Archive, SlidersHorizontal
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import notify from '../lib/notify';
import WooCommerceModal from '../components/WooCommerceModal';
import { SkeletonTable } from '../components/Skeleton';

import ArchiveDetailModal from './archives/ArchiveDetailModal';
import ArchiveFilters from './archives/ArchiveFilters';
import ArchiveList from './archives/ArchiveList';

// ==================== APPOINTMENT SIDEBAR ====================
function AppointmentModal({ isOpen, onClose, date, timeSlot, appointment }) {
    const [formData, setFormData] = useState({ fullName: '', phone: '', shootTypeId: '', description1: '', description2: '' });
    const queryClient = useQueryClient();
    const isEdit = !!appointment;

    const { data: shootTypes } = useQuery({ queryKey: ['shootTypes'], queryFn: () => optionsApi.getShootTypes().then(r => r.data) });

    useEffect(() => {
        if (appointment) {
            setFormData({
                fullName: appointment.fullName || '',
                phone: appointment.phone || '',
                shootTypeId: appointment.shootTypeId?.toString() || '',
                description1: appointment.description1 || '',
                description2: appointment.description2 || ''
            });
        } else {
            setFormData({ fullName: '', phone: '', shootTypeId: '', description1: '', description2: '' });
        }
    }, [appointment]);

    const createMutation = useMutation({
        mutationFn: (data) => appointmentsApi.create({ ...data, appointmentDate: date, timeSlot }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); notify.success('Randevu oluşturuldu'); onClose(); }
    });
    const updateMutation = useMutation({
        mutationFn: (data) => appointmentsApi.update(appointment.id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); notify.success('Randevu güncellendi'); onClose(); }
    });
    const deleteMutation = useMutation({
        mutationFn: () => appointmentsApi.delete(appointment.id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); notify.success('Randevu silindi'); onClose(); }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.fullName || !formData.phone || !formData.shootTypeId) {
            notify.error('Zorunlu alanları doldurun');
            return;
        }
        if (isEdit) updateMutation.mutate(formData);
        else createMutation.mutate(formData);
    };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 select-text">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-semibold">{isEdit ? 'Randevu Düzenle' : 'Yeni Randevu'}</h2>
                        <p className="text-sm text-muted-foreground">{format(new Date(date), 'd MMMM yyyy', { locale: tr })} - {timeSlot || appointment?.timeSlot}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Adı Soyadı *</label>
                        <input type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Telefon *</label>
                        <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Çekim Türü *</label>
                        <select value={formData.shootTypeId} onChange={e => setFormData({ ...formData, shootTypeId: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none">
                            <option value="">Seçin...</option>
                            {shootTypes?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Açıklama 1</label>
                        <input type="text" value={formData.description1} onChange={e => setFormData({ ...formData, description1: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div className="flex gap-3 pt-4">
                        {isEdit && (
                            <button type="button" onClick={() => deleteMutation.mutate()} className="px-4 py-2 border border-destructive text-destructive rounded-lg hover:bg-destructive/10">Sil</button>
                        )}
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">İptal</button>
                        <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                            {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isEdit ? 'Güncelle' : 'Kaydet'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function AppointmentSidebar({ onTransferToArchive }) {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showModal, setShowModal] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState('');
    const [selectedAppointment, setSelectedAppointment] = useState(null);

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const { data: dayData, isLoading } = useQuery({
        queryKey: ['appointments', 'day', dateStr],
        queryFn: () => appointmentsApi.getDay(dateStr).then(r => r.data)
    });

    const slots = (() => {
        const result = {};
        for (let h = 8; h <= 20; h++) {
            for (let m = 0; m < 60; m += 30) {
                const slot = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                result[slot] = null;
            }
        }
        const appointments = dayData || [];
        appointments.forEach(apt => {
            const ts = apt.timeSlot;
            if (ts && Object.prototype.hasOwnProperty.call(result, ts)) {
                result[ts] = apt;
            } else if (apt.appointmentDate) {
                const d = new Date(apt.appointmentDate);
                const key = `${String(d.getHours()).padStart(2, '0')}:${String(Math.floor(d.getMinutes() / 30) * 30).padStart(2, '0')}`;
                if (Object.prototype.hasOwnProperty.call(result, key)) result[key] = apt;
            }
        });
        return result;
    })();

    return (
        <div className="bg-card border border-border rounded-xl h-full flex flex-col select-none">
            <div className="flex items-center justify-between p-4 border-b border-border">
                <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="p-2 hover:bg-muted rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                    <input type="date" value={dateStr} onChange={e => setSelectedDate(new Date(e.target.value))} className="bg-transparent text-center font-semibold outline-none cursor-pointer" />
                    <p className="text-sm text-muted-foreground">{format(selectedDate, 'EEEE', { locale: tr })}</p>
                </div>
                <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-2 hover:bg-muted rounded-lg">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="p-3"><SkeletonTable rows={6} columns={2} /></div>
                ) : (
                    <div className="divide-y divide-border">
                        {Object.entries(slots).map(([slot, appointment]) => (
                            <div
                                key={slot}
                                onDoubleClick={() => { setSelectedSlot(slot); setSelectedAppointment(appointment || null); setShowModal(true); }}
                                className={`flex items-center text-sm cursor-pointer transition-colors ${appointment ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}
                            >
                                <span className="w-14 px-2 py-2 font-medium text-muted-foreground border-r border-border text-center">{slot}</span>
                                <div className="flex-1 px-2 py-2 truncate">
                                    {appointment ? (
                                        <span className="font-medium">{appointment.fullName}</span>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </div>
                                {appointment && (
                                    <button
                                        className="p-1 mr-1 rounded hover:bg-primary/20 text-primary/60 hover:text-primary"
                                        title="Arşive Aktar"
                                        onClick={(e) => { e.stopPropagation(); onTransferToArchive?.(appointment); }}
                                    >
                                        <Archive className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <AppointmentModal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setSelectedAppointment(null); }}
                date={dateStr}
                timeSlot={selectedSlot}
                appointment={selectedAppointment}
            />
        </div>
    );
}

// ==================== WHATSAPP MODAL ====================
function WhatsAppModal({ isOpen, onClose, archive }) {
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { if (isOpen) setMessage(''); }, [isOpen]);

    const handleSend = async () => {
        if (!message) return notify.error('Mesaj boş olamaz');
        setLoading(true);
        try {
            await whatsappApi.send({ phone: archive.phone, message });
            notify.success('Mesaj gönderildi');
            onClose();
        } catch (error) {
            notify.error(error.response?.data?.error || 'Mesaj gönderilemedi');
        }
        setLoading(false);
    };

    const paidAmount = (archive?.cashAmount || 0) + (archive?.cardAmount || 0) + (archive?.transferAmount || 0);
    const remainingAmount = (archive?.totalAmount || 0) - paidAmount;

    const presets = [
        { label: 'Randevu Bilgisi', text: `Sayın ${archive?.fullName},\n\nRandevunuz oluşturulmuştur.\n\nTeşekkürler, ${archive?.shootType?.name || 'Stüdyo'}` },
        { label: 'Fotoğraflar Hazır', text: `Sayın ${archive?.fullName},\n\nFotoğraflarınız hazırdır. Stüdyomuzdan teslim alabilirsiniz.\n\nİyi günler dileriz.` },
        { label: 'Ödeme Hatırlatma', text: `Sayın ${archive?.fullName},\n\nÖdemenizle ilgili hatırlatmadır.${remainingAmount > 0 ? `\n\nKalan tutar: ${remainingAmount.toLocaleString('tr-TR')} ₺` : ''}\n\nTeşekkürler.` },
        { label: 'Teşekkür', text: `Sayın ${archive?.fullName},\n\nBizi tercih ettiğiniz için teşekkür ederiz.` }
    ];

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 select-text">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <MessageCircle className="w-5 h-5 text-green-500" /> WhatsApp Mesajı
                        </h2>
                        <p className="text-sm text-muted-foreground">{archive?.fullName} ({archive?.phone})</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        {presets.map((preset, i) => (
                            <button key={i} onClick={() => setMessage(preset.text)}
                                className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted text-left transition-colors">
                                {preset.label}
                            </button>
                        ))}
                    </div>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mesajınızı yazın..."
                        className="w-full h-32 px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none resize-none" />
                    <div className="flex gap-3 pt-2">
                        <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">İptal</button>
                        <button onClick={() => {
                            const phone = archive?.phone?.replace(/[^0-9]/g, '');
                            const formatted = phone?.startsWith('0') ? '90' + phone.slice(1) : phone;
                            const url = `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
                            if (window.electron?.openExternal) window.electron.openExternal(url);
                            else window.open(url, '_blank');
                            onClose();
                        }} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
                            <ExternalLink className="w-4 h-4" /> WhatsApp'ta Aç
                        </button>
                        <button onClick={handleSend} disabled={loading || !message}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                            Gönder
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==================== MAIN ORCHESTRATOR ====================
export default function Archives() {
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedArchive, setSelectedArchive] = useState(null);
    const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
    const [whatsAppArchive, setWhatsAppArchive] = useState(null);
    const [wcModalOpen, setWcModalOpen] = useState(false);
    const [wcArchive, setWcArchive] = useState(null);
    const [workflowPopup, setWorkflowPopup] = useState(null);
    const queryClient = useQueryClient();
    const location = useLocation();

    // Filter state
    const [showFilters, setShowFilters] = useState(false);
    const [filterShootType, setFilterShootType] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [filterSchool, setFilterSchool] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Resizable sidebar
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem('archives_sidebar_width');
        return saved ? parseInt(saved, 10) : 320;
    });
    const isDragging = useRef(false);
    const containerRef = useRef(null);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        isDragging.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        const onMouseMove = (e) => {
            if (!isDragging.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const newWidth = Math.max(200, Math.min(600, rect.right - e.clientX));
            setSidebarWidth(newWidth);
        };
        const onMouseUp = () => {
            isDragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            setSidebarWidth(w => { localStorage.setItem('archives_sidebar_width', w); return w; });
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, []);

    // Dropdown data for filters
    const { data: shootTypes } = useQuery({ queryKey: ['shootTypes'], queryFn: () => optionsApi.getShootTypes().then(r => r.data) });
    const { data: locations } = useQuery({ queryKey: ['locations'], queryFn: () => optionsApi.getLocations().then(r => r.data) });
    const { data: schools } = useQuery({ queryKey: ['schools'], queryFn: () => schoolsApi.list().then(r => r.data || []) });
    const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.getAll().then(r => r.data) });

    const hasActiveFilters = !!(filterShootType || filterLocation || filterSchool || filterStatus);
    const clearAllFilters = () => { setFilterShootType(''); setFilterLocation(''); setFilterSchool(''); setFilterStatus(''); };

    // Prefill from Appointments 'arşive aktar'
    useEffect(() => {
        if (location.state?.openModal) {
            const prefill = location.state?.prefill || {};
            setSelectedArchive(prefill.fullName ? { ...prefill, _isPrefill: true } : null);
            setShowModal(true);
            window.history.replaceState({}, document.title);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Workflow mutation
    const advanceWorkflowMutation = useMutation({
        mutationFn: ({ archiveId, newStatus }) => archivesApi.update(archiveId, { workflowStatus: newStatus }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['archives'] }); notify.success('Durum güncellendi'); setWorkflowPopup(null); },
        onError: () => notify.error('Durum güncellenemedi')
    });

    // Pagination
    const [allArchives, setAllArchives] = useState([]);
    const [lastDocId, setLastDocId] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const { data: archivesData, isLoading } = useQuery({
        queryKey: ['archives', search],
        queryFn: () => archivesApi.list({ search, limit: 50 })
    });

    useEffect(() => {
        if (archivesData) {
            setAllArchives(archivesData?.data || []);
            setLastDocId(archivesData?.lastDocId || null);
            setHasMore(archivesData?.hasMore || false);
        }
    }, [archivesData]);

    const loadMore = useCallback(async () => {
        if (!lastDocId || loadingMore) return;
        setLoadingMore(true);
        try {
            const moreData = await archivesApi.list({ search, limit: 50, startAfterDocId: lastDocId });
            setAllArchives(prev => [...prev, ...(moreData?.data || [])]);
            setLastDocId(moreData?.lastDocId || null);
            setHasMore(moreData?.hasMore || false);
        } catch (err) {
            console.error('Load more error:', err);
            notify.error('Daha fazla kayıt yüklenemedi');
        }
        setLoadingMore(false);
    }, [lastDocId, loadingMore, search]);

    // Base path for folder actions
    const settingsBasePath = settings?.general?.archive_base_path;
    const [licenseBasePath, setLicenseBasePath] = useState(null);
    useEffect(() => {
        if (!settingsBasePath && window.electron?.getLicenseConfig) {
            window.electron.getLicenseConfig().then(config => {
                if (config?.studios?.length > 0 && config.studios[0].path) setLicenseBasePath(config.studios[0].path);
                else if (config?.archiveBasePath) setLicenseBasePath(config.archiveBasePath);
            }).catch(() => { });
        }
    }, [settingsBasePath]);
    const basePath = settingsBasePath || licenseBasePath;

    // Client-side filtering
    const archives = allArchives.filter(arc => {
        if (filterShootType && (arc.shootTypeId?.toString() !== filterShootType && arc.shootType?.id?.toString() !== filterShootType)) return false;
        if (filterLocation && (arc.locationId?.toString() !== filterLocation && arc.location?.id?.toString() !== filterLocation)) return false;
        if (filterSchool && arc.schoolId !== filterSchool) return false;
        if (filterStatus && arc.workflowStatus !== filterStatus) return false;
        return true;
    });

    const handleWorkflowClick = useCallback((e, archive) => {
        e.stopPropagation();
        setWorkflowPopup(prev => prev === archive.id ? null : archive.id);
    }, []);

    return (
        <div ref={containerRef} className="flex h-[calc(100vh-8rem)] select-none">
            {/* Archive List */}
            <div className="flex-1 flex flex-col min-w-0 pr-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4 flex-1">
                        <h1 className="text-2xl font-bold">Arşiv</h1>
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Ara... (arşiv no, isim, telefon)"
                                className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowFilters(f => !f)}
                            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-muted ${hasActiveFilters ? 'border-primary text-primary' : 'border-border'}`}>
                            <SlidersHorizontal className="w-4 h-4" />
                            {hasActiveFilters ? `Filtreler (${[filterShootType, filterLocation, filterSchool, filterStatus].filter(Boolean).length})` : 'Filtrele'}
                        </button>
                        <Link to="/archives/search"
                            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">
                            Detaylı Arama
                        </Link>
                        <button onClick={() => { setSelectedArchive(null); setShowModal(true); }}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                            <Plus className="w-5 h-5" /> Yeni Kayıt
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <ArchiveFilters
                        shootTypes={shootTypes}
                        locations={locations}
                        schools={schools}
                        filterShootType={filterShootType}
                        filterLocation={filterLocation}
                        filterSchool={filterSchool}
                        filterStatus={filterStatus}
                        onChange={(field, value) => {
                            if (field === 'filterShootType') setFilterShootType(value);
                            else if (field === 'filterLocation') setFilterLocation(value);
                            else if (field === 'filterSchool') setFilterSchool(value);
                            else if (field === 'filterStatus') setFilterStatus(value);
                        }}
                        onClear={clearAllFilters}
                    />
                )}

                <ArchiveList
                    archives={archives}
                    isLoading={isLoading}
                    hasMore={hasMore}
                    search={search}
                    loadingMore={loadingMore}
                    hasActiveFilters={hasActiveFilters}
                    basePath={basePath}
                    workflowPopup={workflowPopup}
                    onDoubleClick={(arc) => { setSelectedArchive(arc); setShowModal(true); }}
                    onWorkflowClick={handleWorkflowClick}
                    onAdvanceWorkflow={(arcId, newStatus) => advanceWorkflowMutation.mutate({ archiveId: arcId, newStatus })}
                    onWhatsApp={(arc) => { setWhatsAppArchive(arc); setWhatsAppModalOpen(true); }}
                    onWooCommerce={(arc) => { setWcArchive(arc); setWcModalOpen(true); }}
                    onClearFilters={clearAllFilters}
                    onLoadMore={loadMore}
                />
            </div>

            {/* Draggable Splitter */}
            <div
                onMouseDown={handleMouseDown}
                className="w-[6px] shrink-0 cursor-col-resize group relative hover:bg-primary/30 active:bg-primary/50 transition-colors"
                title="Sürükleyerek boyutlandır"
            >
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-border group-hover:bg-primary/60 transition-colors" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1">
                    <div className="w-1 h-1 rounded-full bg-muted-foreground/40 group-hover:bg-primary" />
                    <div className="w-1 h-1 rounded-full bg-muted-foreground/40 group-hover:bg-primary" />
                    <div className="w-1 h-1 rounded-full bg-muted-foreground/40 group-hover:bg-primary" />
                </div>
            </div>

            {/* Appointment Sidebar */}
            <div className="shrink-0" style={{ width: sidebarWidth }}>
                <AppointmentSidebar onTransferToArchive={(apt) => {
                    setSelectedArchive({
                        fullName: apt.fullName || '',
                        phone: apt.phone || '',
                        email: apt.email || '',
                        shootTypeId: apt.shootTypeId || '',
                        locationId: apt.locationId || '',
                        photographerId: apt.photographerId || '',
                        description1: apt.description1 || '',
                        _isPrefill: true
                    });
                    setShowModal(true);
                }} />
            </div>

            <ArchiveDetailModal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setSelectedArchive(null); }}
                archive={selectedArchive}
            />

            <WhatsAppModal
                isOpen={whatsAppModalOpen}
                onClose={() => { setWhatsAppModalOpen(false); setWhatsAppArchive(null); }}
                archive={whatsAppArchive}
            />

            <WooCommerceModal
                isOpen={wcModalOpen}
                onClose={() => { setWcModalOpen(false); setWcArchive(null); }}
                archive={wcArchive}
            />
        </div>
    );
}

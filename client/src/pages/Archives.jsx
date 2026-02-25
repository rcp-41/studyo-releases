import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { archivesApi, appointmentsApi, optionsApi, settingsApi, whatsappApi, schoolsApi } from '../services/api';
import { format, addDays, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
    Plus, Search, ChevronLeft, ChevronRight, X, Loader2,
    MessageCircle, Globe, HardDrive, Folder, SlidersHorizontal, UserCircle, Archive, ExternalLink
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import WooCommerceModal from '../components/WooCommerceModal';
import PhoneInput from '../components/PhoneInput';
import { SkeletonTable } from '../components/Skeleton';

// Workflow Status Badge
const WORKFLOW_STATUSES = {
    selection_pending: { label: 'Seçim Yapılacak', color: 'bg-yellow-500/15 text-yellow-600' },
    preparing: { label: 'Hazırlanıyor', color: 'bg-blue-500/15 text-blue-600' },
    printing: { label: 'Basılacak', color: 'bg-purple-500/15 text-purple-600' },
    ready: { label: 'Hazır', color: 'bg-green-500/15 text-green-600' },
    delivered: { label: 'Teslim Edildi', color: 'bg-gray-500/15 text-gray-500' }
};

const WORKFLOW_ORDER = ['selection_pending', 'preparing', 'printing', 'ready', 'delivered'];

function WorkflowBadge({ status }) {
    const s = WORKFLOW_STATUSES[status] || WORKFLOW_STATUSES.selection_pending;
    return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${s.color}`}>{s.label}</span>;
}

function PaymentBadge({ totalAmount, cashAmount, cardAmount, transferAmount }) {
    const total = totalAmount || 0;
    const paid = (cashAmount || 0) + (cardAmount || 0) + (transferAmount || 0);
    const remaining = total - paid;
    if (total === 0) return null;
    if (remaining <= 0) return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-500/15 text-green-600">Ödendi</span>;
    if (paid === 0) return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/15 text-red-600">Ödenmedi (₺{remaining})</span>;
    return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-600">Kapora (₺{remaining} kalan)</span>;
}

// Archive Modal (Add/Edit)
function ArchiveModal({ isOpen, onClose, archive }) {
    const [formData, setFormData] = useState({
        shootDate: new Date().toISOString().split('T')[0],
        fullName: '', phone: '', email: '',
        shootTypeId: '', locationId: '', photographerId: '',
        schoolId: '', className: '', section: '',
        description1: '', description2: '',
        totalAmount: '', cashAmount: '', cardAmount: '', transferAmount: '',
        workflowStatus: 'selection_pending'
    });
    const queryClient = useQueryClient();
    const isEdit = !!(archive && archive.id && !archive._isPrefill);

    // Fetch next archive number for new records
    const { data: nextNumberData } = useQuery({
        queryKey: ['nextArchiveNumber'],
        queryFn: () => archivesApi.getNextNumber().then(r => r.nextNumber),
        enabled: isOpen && !isEdit,
        staleTime: 0
    });

    const { data: shootTypes } = useQuery({ queryKey: ['shootTypes'], queryFn: () => optionsApi.getShootTypes().then(r => r.data) });
    const { data: locations } = useQuery({ queryKey: ['locations'], queryFn: () => optionsApi.getLocations().then(r => r.data) });
    const { data: photographers } = useQuery({ queryKey: ['photographers'], queryFn: () => optionsApi.getPhotographers().then(r => r.data) });
    const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.getAll().then(r => r.data) });
    const { data: schools } = useQuery({ queryKey: ['schools'], queryFn: () => schoolsApi.list().then(r => r.data || []) });

    useEffect(() => {
        if (isOpen) {
            if (archive) {
                // Parse shootDate: handle Firestore Timestamp, ISO string, or date string
                let parsedShootDate = new Date().toISOString().split('T')[0];
                if (archive.shootDate) {
                    if (typeof archive.shootDate === 'object' && archive.shootDate._seconds) {
                        parsedShootDate = new Date(archive.shootDate._seconds * 1000).toISOString().split('T')[0];
                    } else if (typeof archive.shootDate === 'string') {
                        parsedShootDate = archive.shootDate.split('T')[0];
                    }
                } else if (archive.appointmentDate) {
                    parsedShootDate = archive.appointmentDate.split?.('T')[0] || parsedShootDate;
                }

                // Use enriched object IDs (Firestore doc IDs) for dropdown matching
                // Backend returns arc.shootType, arc.location, arc.photographer as enriched objects
                const resolvedShootTypeId = archive.shootType?.id?.toString() || archive.shootTypeId?.toString() || '';
                const resolvedLocationId = archive.location?.id?.toString() || archive.locationId?.toString() || '';
                const resolvedPhotographerId = archive.photographer?.id?.toString() || archive.photographerId?.toString() || '';

                setFormData({
                    shootDate: parsedShootDate,
                    fullName: archive.fullName || '',
                    phone: archive.phone || '',
                    email: archive.email || '',
                    shootTypeId: resolvedShootTypeId,
                    locationId: resolvedLocationId,
                    photographerId: resolvedPhotographerId,
                    schoolId: archive.schoolId || '',
                    className: archive.className || '',
                    section: archive.section || '',
                    description1: archive.description1 || '',
                    description2: archive.description2 || '',
                    totalAmount: archive.totalAmount?.toString() || '',
                    cashAmount: archive.cashAmount?.toString() || '',
                    cardAmount: archive.cardAmount?.toString() || '',
                    transferAmount: archive.transferAmount?.toString() || '',
                    workflowStatus: archive.workflowStatus || 'selection_pending'
                });
            } else {
                setFormData({
                    shootDate: new Date().toISOString().split('T')[0],
                    fullName: '', phone: '', email: '',
                    shootTypeId: shootTypes?.[0]?.id?.toString() || '',
                    locationId: locations?.[0]?.id?.toString() || '',
                    photographerId: photographers?.[0]?.id?.toString() || '',
                    schoolId: '', className: '', section: '',
                    description1: '', description2: '',
                    totalAmount: '', cashAmount: '', cardAmount: '', transferAmount: '',
                    workflowStatus: 'selection_pending'
                });
            }
        }
    }, [isOpen, archive, shootTypes, locations, photographers]);

    const createMutation = useMutation({
        mutationFn: (data) => archivesApi.create(data),
        onSuccess: async (response) => {
            const archive = response || {};
            const archiveNum = archive.archiveId || archive.archiveNumber;

            // Try to create folder for this archive
            if (archiveNum && window.electron?.createFolder) {
                try {
                    // 1. Try Firestore settings first
                    let basePath = settings?.general?.archive_base_path;

                    // 2. Fallback: read from Electron license config (studios array)
                    if (!basePath && window.electron?.getLicenseConfig) {
                        try {
                            const licenseConfig = await window.electron.getLicenseConfig();
                            if (licenseConfig?.studios?.length > 0) {
                                basePath = licenseConfig.studios[0].path;
                            } else if (licenseConfig?.archiveBasePath) {
                                basePath = licenseConfig.archiveBasePath;
                            }
                        } catch (lcErr) {
                            // License config read failed
                        }
                    }

                    if (basePath) {
                        // Register base path as allowed in Electron before creating subfolder
                        if (window.electron?.addAllowedPath) {
                            await window.electron.addAllowedPath(basePath);
                        }
                        const folderPath = `${basePath}\\${archiveNum}`;
                        const result = await window.electron.createFolder(folderPath);
                        if (result.success) {
                            // Update archive with folder path (don't await - fire and forget)
                            if (archive.id) {
                                archivesApi.update(archive.id, { folderPath }).catch(console.error);
                            }
                        }
                    }
                } catch (err) {
                    // Folder creation error — non-critical
                }
            }

            queryClient.invalidateQueries({ queryKey: ['archives'] });
            toast.success('Kayıt oluşturuldu');
            onClose();
        },
        onError: (error) => {
            console.error('Create archive error:', error);
            toast.error('Kayıt oluşturulamadı');
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data) => archivesApi.update(archive.id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['archives'] }); toast.success('Kayıt güncellendi'); onClose(); },
        onError: (error) => { console.error('Update error:', error); toast.error('Kayıt güncellenemedi'); }
    });

    const deleteMutation = useMutation({
        mutationFn: () => archivesApi.delete(archive.id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['archives'] }); toast.success('Kayıt silindi'); onClose(); },
        onError: (error) => { console.error('Delete error:', error); toast.error('Kayıt silinemedi'); }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.fullName || !formData.phone || !formData.shootTypeId || !formData.locationId || !formData.photographerId) {
            toast.error('Zorunlu alanları doldurun');
            return;
        }
        const data = {
            ...formData,
            totalAmount: parseFloat(formData.totalAmount) || 0,
            cashAmount: parseFloat(formData.cashAmount) || 0,
            cardAmount: parseFloat(formData.cardAmount) || 0,
            transferAmount: parseFloat(formData.transferAmount) || 0
        };
        if (isEdit) {
            updateMutation.mutate(data);
        } else {
            createMutation.mutate(data);
        }
    };

    // Calculate paid and remaining
    const total = parseFloat(formData.totalAmount) || 0;
    const paid = (parseFloat(formData.cashAmount) || 0) + (parseFloat(formData.cardAmount) || 0) + (parseFloat(formData.transferAmount) || 0);
    const remaining = total - paid;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-[900px] p-6 max-h-[90vh] overflow-y-auto select-text">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-semibold">{isEdit ? 'Kayıt Düzenle' : 'Yeni Kayıt'}</h2>
                        <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm font-bold tabular-nums">
                            #{isEdit ? (archive?.archiveNumber || archive?.archiveId || '—') : (nextNumberData || '...')}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Müşteri Bilgileri */}
                    <div className="bg-muted/30 border border-border rounded-lg p-4">
                        <h3 className="text-sm font-medium text-muted-foreground mb-3">Müşteri Bilgileri</h3>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">Adı Soyadı *</label>
                                <input type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Telefon *</label>
                                <PhoneInput
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    onCustomerFound={(customer) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            fullName: customer.fullName || prev.fullName,
                                            email: customer.email || prev.email
                                        }));
                                    }}
                                    className="text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">E-posta</label>
                                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm" />
                            </div>
                        </div>
                    </div>

                    {/* Çekim Bilgileri */}
                    <div className="bg-muted/30 border border-border rounded-lg p-4">
                        <h3 className="text-sm font-medium text-muted-foreground mb-3">Çekim Bilgileri</h3>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">Çekim Tarihi</label>
                                <input
                                    type="date"
                                    value={formData.shootDate}
                                    onChange={e => setFormData({ ...formData, shootDate: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Çekim Türü *</label>
                                <select value={formData.shootTypeId} onChange={e => setFormData({ ...formData, shootTypeId: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm">
                                    <option value="">Seçin...</option>
                                    {shootTypes?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Çekim Yeri *</label>
                                <select value={formData.locationId} onChange={e => setFormData({ ...formData, locationId: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm">
                                    <option value="">Seçin...</option>
                                    {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">Çekimci *</label>
                                <select value={formData.photographerId} onChange={e => setFormData({ ...formData, photographerId: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm">
                                    <option value="">Seçin...</option>
                                    {photographers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Okul Bilgileri (opsiyonel) */}
                        {schools && schools.length > 0 && (
                            <div className="grid grid-cols-3 gap-3 mt-3">
                                <div>
                                    <label className="block text-xs font-medium mb-1">Okul</label>
                                    <select value={formData.schoolId} onChange={e => setFormData({ ...formData, schoolId: e.target.value, className: '' })} className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm">
                                        <option value="">— Okul yok —</option>
                                        {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Sınıf</label>
                                    {(() => {
                                        const school = schools?.find(s => s.id === formData.schoolId);
                                        const classes = school?.classes || [];
                                        if (classes.length > 0) {
                                            return (
                                                <select value={formData.className} onChange={e => setFormData({ ...formData, className: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm">
                                                    <option value="">Seçin...</option>
                                                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            );
                                        }
                                        return <input type="text" value={formData.className} onChange={e => setFormData({ ...formData, className: e.target.value })} placeholder="Ör: 4-A" className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm" />;
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* İş Akışı Durumu */}
                    {isEdit && (
                        <div className="bg-muted/30 border border-border rounded-lg p-4">
                            <h3 className="text-sm font-medium text-muted-foreground mb-3">İş Akışı Durumu</h3>
                            <div className="flex gap-2 flex-wrap">
                                {WORKFLOW_ORDER.map(key => {
                                    const ws = WORKFLOW_STATUSES[key];
                                    const isActive = formData.workflowStatus === key;
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, workflowStatus: key })}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${isActive
                                                ? `${ws.color} border-current ring-2 ring-current/20`
                                                : 'border-border text-muted-foreground hover:bg-muted'
                                                }`}
                                        >
                                            {ws.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Açıklamalar */}
                    <div className="bg-muted/30 border border-border rounded-lg p-4">
                        <h3 className="text-sm font-medium text-muted-foreground mb-3">Açıklamalar</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">Açıklama 1</label>
                                <input type="text" value={formData.description1} onChange={e => setFormData({ ...formData, description1: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Açıklama 2</label>
                                <input type="text" value={formData.description2} onChange={e => setFormData({ ...formData, description2: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm" />
                            </div>
                        </div>
                    </div>

                    {/* Ödeme */}
                    <div className="bg-muted/30 border border-border rounded-lg p-4">
                        <h3 className="text-sm font-medium text-muted-foreground mb-3">Ödeme</h3>

                        <div className="mb-4">
                            <label className="block text-xs font-medium mb-1">Toplam Tutar</label>
                            <input type="number" value={formData.totalAmount} onChange={e => setFormData({ ...formData, totalAmount: e.target.value })} placeholder="₺" className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-lg font-semibold" />
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <div>
                                <label className="block text-xs font-medium mb-1 text-center">Nakit</label>
                                <input type="number" value={formData.cashAmount} onChange={e => setFormData({ ...formData, cashAmount: e.target.value })} placeholder="₺" className="w-full px-2 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-center" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1 text-center">Kart</label>
                                <input type="number" value={formData.cardAmount} onChange={e => setFormData({ ...formData, cardAmount: e.target.value })} placeholder="₺" className="w-full px-2 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-center" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1 text-center">Havale</label>
                                <input type="number" value={formData.transferAmount} onChange={e => setFormData({ ...formData, transferAmount: e.target.value })} placeholder="₺" className="w-full px-2 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-center" />
                            </div>
                        </div>

                        {total > 0 && (
                            <div className={`text-center p-2 rounded-lg ${remaining > 0 ? 'bg-red-500/20 text-red-400' : remaining < 0 ? 'bg-green-500/20 text-green-400' : 'bg-green-500/20 text-green-400'}`}>
                                {remaining > 0 ? (
                                    <span>Kalan: <strong>₺{remaining.toFixed(2)}</strong></span>
                                ) : remaining < 0 ? (
                                    <span>Fazla: <strong>₺{Math.abs(remaining).toFixed(2)}</strong></span>
                                ) : (
                                    <span>✓ Tam Ödendi</span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        {isEdit && (
                            <button type="button" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="px-4 py-2 border border-destructive text-destructive rounded-lg hover:bg-destructive/10 disabled:opacity-50">
                                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sil'}
                            </button>
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

// Appointment Modal (Add/Edit)
function AppointmentModal({ isOpen, onClose, date, timeSlot, appointment }) {
    const [formData, setFormData] = useState({ fullName: '', phone: '', shootTypeId: '', description1: '', description2: '' });
    const queryClient = useQueryClient();
    const isEdit = !!appointment;

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

    const { data: shootTypes } = useQuery({ queryKey: ['shootTypes'], queryFn: () => optionsApi.getShootTypes().then(r => r.data) });

    const createMutation = useMutation({
        mutationFn: (data) => appointmentsApi.create({ ...data, appointmentDate: date, timeSlot }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); toast.success('Randevu oluşturuldu'); onClose(); }
    });

    const updateMutation = useMutation({
        mutationFn: (data) => appointmentsApi.update(appointment.id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); toast.success('Randevu güncellendi'); onClose(); }
    });

    const deleteMutation = useMutation({
        mutationFn: () => appointmentsApi.delete(appointment.id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); toast.success('Randevu silindi'); onClose(); }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.fullName || !formData.phone || !formData.shootTypeId) {
            toast.error('Zorunlu alanları doldurun');
            return;
        }
        if (isEdit) {
            updateMutation.mutate(formData);
        } else {
            createMutation.mutate(formData);
        }
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
                        <label className="block text-sm font-medium mb-1">Telefon Numarası *</label>
                        <PhoneInput
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            onCustomerFound={(customer) => {
                                setFormData(prev => ({
                                    ...prev,
                                    fullName: customer.fullName || prev.fullName
                                }));
                            }}
                        />
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
                    <div>
                        <label className="block text-sm font-medium mb-1">Açıklama 2</label>
                        <input type="text" value={formData.description2} onChange={e => setFormData({ ...formData, description2: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
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

// Appointment Sidebar
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

    const handleSlotDoubleClick = (slot, appointment) => {
        setSelectedSlot(slot);
        setSelectedAppointment(appointment || null);
        setShowModal(true);
    };

    // Build time slots grid (30-min intervals, 08:00 - 20:00)
    const slots = (() => {
        const result = {};
        for (let h = 8; h <= 20; h++) {
            for (let m = 0; m < 60; m += 30) {
                const slot = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                result[slot] = null;
            }
        }
        // Map appointments into their slots
        const appointments = dayData || [];
        appointments.forEach(apt => {
            const ts = apt.timeSlot;
            if (ts && result.hasOwnProperty(ts)) {
                result[ts] = apt;
            } else if (apt.appointmentDate) {
                // Fallback: derive slot from appointmentDate hour/minute
                const d = new Date(apt.appointmentDate);
                const key = `${String(d.getHours()).padStart(2, '0')}:${String(Math.floor(d.getMinutes() / 30) * 30).padStart(2, '0')}`;
                if (result.hasOwnProperty(key)) {
                    result[key] = apt;
                }
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
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                ) : (
                    <div className="divide-y divide-border">
                        {Object.entries(slots).map(([slot, appointment]) => (
                            <div
                                key={slot}
                                onDoubleClick={() => handleSlotDoubleClick(slot, appointment)}
                                className={`flex items-center text-sm cursor-pointer transition-colors ${appointment ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}
                            >
                                <span className="w-14 px-2 py-2 font-medium text-muted-foreground border-r border-border text-center">{slot}</span>
                                <div className="flex-1 px-2 py-2 truncate">
                                    {appointment ? (
                                        <>
                                            <span className="font-medium">{appointment.fullName}</span>
                                            <span className="text-xs text-muted-foreground mx-1">-</span>
                                            <span className="text-xs">{appointment.shootType?.name}</span>
                                            {appointment.description1 && (
                                                <>
                                                    <span className="text-xs text-muted-foreground mx-1">+</span>
                                                    <span className="text-xs text-muted-foreground">{appointment.description1}</span>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </div>
                                {appointment && (
                                    <button
                                        className="p-1 mr-1 rounded hover:bg-primary/20 text-primary/60 hover:text-primary"
                                        title="Arşive Aktar"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onTransferToArchive?.(appointment);
                                        }}
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

// WhatsApp Modal
function WhatsAppModal({ isOpen, onClose, archive }) {
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) setMessage('');
    }, [isOpen]);

    const handleSend = async () => {
        if (!message) return toast.error('Mesaj boş olamaz');

        setLoading(true);
        try {
            await whatsappApi.send({ phone: archive.phone, message });
            toast.success('Mesaj gönderildi');
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Mesaj gönderilemedi');
        }
        setLoading(false);
    };

    // Calculate remaining payment
    const paidAmount = (archive?.cashAmount || 0) + (archive?.cardAmount || 0) + (archive?.transferAmount || 0);
    const remainingAmount = (archive?.totalAmount || 0) - paidAmount;

    const presets = [
        { label: 'Randevu Bilgisi', text: `Sayın ${archive?.fullName},\n\nRandevunuz oluşturulmuştur. Tarih: ${format(new Date(archive?.createdAt || new Date()), 'dd.MM.yyyy')}\n\nTeşekkürler, ${archive?.shootType?.name || 'Stüdyo'}` },
        { label: 'Fotoğraflar Hazır', text: `Sayın ${archive?.fullName},\n\nFotoğraflarınız hazırdır. Stüdyomuzdan teslim alabilirsiniz.\n\nİyi günler dileriz.` },
        { label: 'Ödeme Hatırlatma', text: `Sayın ${archive?.fullName},\n\nÖdemenizle ilgili hatırlatmadır.${remainingAmount > 0 ? `\n\nKalan tutar: ${remainingAmount.toLocaleString('tr-TR')} ₺` : ''}\n\nLütfen en kısa sürede iletişime geçiniz.\n\nTeşekkürler.` },
        { label: 'Teşekkür', text: `Sayın ${archive?.fullName},\n\nBizi tercih ettiğiniz için teşekkür ederiz. Tekrar görüşmek dileğiyle.` }
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
                            <button
                                key={i}
                                onClick={() => setMessage(preset.text)}
                                className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted text-left transition-colors"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    <div>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Mesajınızı yazın..."
                            className="w-full h-32 px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">İptal</button>
                        <button onClick={() => {
                            const phone = archive?.phone?.replace(/[^0-9]/g, '');
                            const formatted = phone?.startsWith('0') ? '90' + phone.slice(1) : phone;
                            const url = `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
                            if (window.electron?.openExternal) {
                                window.electron.openExternal(url);
                            } else {
                                window.open(url, '_blank');
                            }
                            onClose();
                        }}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
                            <ExternalLink className="w-4 h-4" /> WhatsApp'ta Aç
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={loading || !message}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                            Gönder
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Main Archive Page
export default function Archives() {
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedArchive, setSelectedArchive] = useState(null);
    const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
    const [whatsAppArchive, setWhatsAppArchive] = useState(null);
    const [wcModalOpen, setWcModalOpen] = useState(false);
    const [wcArchive, setWcArchive] = useState(null);
    const queryClient = useQueryClient();
    const [workflowPopup, setWorkflowPopup] = useState(null);
    const location = useLocation();
    const navigate = useNavigate();

    // Resizable splitter state
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
            const containerRect = containerRef.current.getBoundingClientRect();
            const newWidth = containerRect.right - e.clientX;
            const clamped = Math.max(200, Math.min(600, newWidth));
            setSidebarWidth(clamped);
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

    // Filter state
    const [showFilters, setShowFilters] = useState(false);
    const [filterShootType, setFilterShootType] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [filterSchool, setFilterSchool] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Dropdown data for filters
    const { data: shootTypes } = useQuery({ queryKey: ['shootTypes'], queryFn: () => optionsApi.getShootTypes().then(r => r.data) });
    const { data: locations } = useQuery({ queryKey: ['locations'], queryFn: () => optionsApi.getLocations().then(r => r.data) });
    const { data: schools } = useQuery({ queryKey: ['schools'], queryFn: () => schoolsApi.list().then(r => r.data || []) });

    const hasActiveFilters = filterShootType || filterLocation || filterSchool || filterStatus;
    const clearAllFilters = () => { setFilterShootType(''); setFilterLocation(''); setFilterSchool(''); setFilterStatus(''); };

    // Handle prefill from Appointments 'arşive aktar' action
    useEffect(() => {
        if (location.state?.openModal) {
            const prefill = location.state?.prefill || {};
            // Open modal with a"virtual" archive record pre-populated from appointment data
            setSelectedArchive(prefill.fullName ? { ...prefill, _isPrefill: true } : null);
            setShowModal(true);
            // Clear location state so refresh doesn't reopen
            window.history.replaceState({}, document.title);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Workflow status update
    const advanceWorkflowMutation = useMutation({
        mutationFn: ({ archiveId, newStatus }) => archivesApi.update(archiveId, { workflowStatus: newStatus }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['archives'] });
            toast.success('Durum güncellendi');
            setWorkflowPopup(null);
        },
        onError: () => toast.error('Durum güncellenemedi')
    });

    const handleWorkflowClick = useCallback((e, archive) => {
        e.stopPropagation();
        setWorkflowPopup(prev => prev === archive.id ? null : archive.id);
    }, []);

    // Pagination state
    const [allArchives, setAllArchives] = useState([]);
    const [lastDocId, setLastDocId] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const { data: archivesData, isLoading } = useQuery({
        queryKey: ['archives', search],
        queryFn: () => archivesApi.list({ search, limit: 50 }),
        onSuccess: (data) => {
            setAllArchives(data?.data || []);
            setLastDocId(data?.lastDocId || null);
            setHasMore(data?.hasMore || false);
        }
    });

    // Sync archives when query data changes (for react-query v5 compatibility)
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
            const newArchives = moreData?.data || [];
            setAllArchives(prev => [...prev, ...newArchives]);
            setLastDocId(moreData?.lastDocId || null);
            setHasMore(moreData?.hasMore || false);
        } catch (err) {
            console.error('Load more error:', err);
            toast.error('Daha fazla kayit yuklenemedi');
        }
        setLoadingMore(false);
    }, [lastDocId, loadingMore, search]);

    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsApi.getAll().then(r => r.data)
    });

    const archives_raw = allArchives;
    const basePath = settings?.general?.archive_base_path;

    // Client-side filtering
    const archives = archives_raw.filter(arc => {
        if (filterShootType && (arc.shootTypeId?.toString() !== filterShootType && arc.shootType?.id?.toString() !== filterShootType)) return false;
        if (filterLocation && (arc.locationId?.toString() !== filterLocation && arc.location?.id?.toString() !== filterLocation)) return false;
        if (filterSchool && arc.schoolId !== filterSchool) return false;
        if (filterStatus && arc.workflowStatus !== filterStatus) return false;
        return true;
    });

    const handleArchiveDoubleClick = (archive) => {
        setSelectedArchive(archive);
        setShowModal(true);
    };

    const handleNewArchive = () => {
        setSelectedArchive(null);
        setShowModal(true);
    };

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
                        <Link to="/archives/search"
                            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">
                            <SlidersHorizontal className="w-4 h-4" />
                            Detaylı Arama
                        </Link>
                        <button onClick={handleNewArchive} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                            <Plus className="w-5 h-5" /> Yeni Kayıt
                        </button>
                    </div>
                </div>

                {/* Archive Table */}
                <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 sticky top-0 border-b border-border">
                                <tr>
                                    <th className="text-left px-3 py-2 font-medium w-20 border-r border-border">Arşiv</th>
                                    <th className="text-left px-3 py-2 font-medium border-r border-border">Ad Soyad</th>
                                    <th className="text-left px-3 py-2 font-medium w-24 border-r border-border hidden sm:table-cell">Tarih</th>
                                    <th className="text-left px-3 py-2 font-medium border-r border-border hidden md:table-cell">Çekim Türü</th>
                                    <th className="text-left px-3 py-2 font-medium border-r border-border hidden lg:table-cell">Yer</th>
                                    <th className="text-left px-3 py-2 font-medium border-r border-border hidden lg:table-cell">Açıklama 1</th>
                                    <th className="text-right px-3 py-2 font-medium w-32">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr><td colSpan={7} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                                ) : archives.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Archive className="w-8 h-8 opacity-40" />
                                            <p>{hasActiveFilters || search ? 'Filtrelere uygun kayıt bulunamadı' : 'Henüz kayıt yok'}</p>
                                            {hasActiveFilters && (
                                                <button onClick={clearAllFilters} className="text-xs text-primary hover:underline">Filtreleri Temizle</button>
                                            )}
                                        </div>
                                    </td></tr>
                                ) : (
                                    archives.map(arc => (
                                        <tr
                                            key={arc.id}
                                            className="hover:bg-muted/30 cursor-pointer"
                                            onDoubleClick={() => handleArchiveDoubleClick(arc)}
                                        >
                                            <td className="px-3 py-2 font-mono text-xs border-r border-border">{arc.archiveNumber || `#${archives.indexOf(arc) + 1}`}</td>
                                            <td className="px-3 py-2 font-medium border-r border-border">
                                                <div>{arc.fullName}</div>
                                                <div className="flex gap-2 mt-1">
                                                    <div className="relative">
                                                        <button onClick={(e) => handleWorkflowClick(e, arc)} title="Durumu değiştir"><WorkflowBadge status={arc.workflowStatus} /></button>
                                                        {workflowPopup === arc.id && (
                                                            <>
                                                                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setWorkflowPopup(null); }} />
                                                                <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl p-1.5 min-w-[140px]">
                                                                    {WORKFLOW_ORDER.map(key => {
                                                                        const ws = WORKFLOW_STATUSES[key];
                                                                        const isActive = (arc.workflowStatus || 'selection_pending') === key;
                                                                        return (
                                                                            <button
                                                                                key={key}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    advanceWorkflowMutation.mutate({ archiveId: arc.id, newStatus: key });
                                                                                }}
                                                                                className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition-colors ${isActive ? `${ws.color}` : 'hover:bg-muted text-muted-foreground'
                                                                                    }`}
                                                                            >
                                                                                {isActive ? '✓ ' : ''}{ws.label}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    <PaymentBadge totalAmount={arc.totalAmount} cashAmount={arc.cashAmount} cardAmount={arc.cardAmount} transferAmount={arc.transferAmount} />
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-muted-foreground border-r border-border hidden sm:table-cell">{format(new Date(arc.createdAt), 'dd.MM.yyyy')}</td>
                                            <td className="px-3 py-2 border-r border-border hidden md:table-cell">{arc.shootType?.name}</td>
                                            <td className="px-3 py-2 border-r border-border hidden lg:table-cell">{arc.location?.name}</td>
                                            <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px] border-r border-border hidden lg:table-cell">{arc.description1 || '-'}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        className="p-1.5 hover:bg-muted rounded text-indigo-500 hover:text-indigo-600"
                                                        title="Müşteri Profili"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const phone = arc.phone || '';
                                                            const name = encodeURIComponent(arc.fullName || '');
                                                            navigate(`/customers/detail?phone=${phone}&name=${name}`);
                                                        }}
                                                    >
                                                        <UserCircle className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        className="p-1.5 hover:bg-muted rounded text-green-500 hover:text-green-600"
                                                        title="WhatsApp Mesaj Gönder"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setWhatsAppArchive(arc);
                                                            setWhatsAppModalOpen(true);
                                                        }}
                                                    >
                                                        <MessageCircle className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        className="p-1.5 hover:bg-muted rounded text-blue-500 hover:text-blue-600"
                                                        title="WooCommerce"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setWcArchive(arc);
                                                            setWcModalOpen(true);
                                                        }}
                                                    >
                                                        <Globe className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        className="p-1.5 hover:bg-muted rounded"
                                                        title="Google Drive'a Yükle"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            try {
                                                                const { googleDrive } = await import('../services/googleDrive');
                                                                if (!googleDrive.isAvailable()) {
                                                                    toast.error('Google Drive sadece masaüstü uygulamasında kullanılabilir');
                                                                    return;
                                                                }
                                                                const status = await googleDrive.getStatus();
                                                                if (!status.connected) {
                                                                    toast.error('Google Drive bağlı değil. Ayarlar > API Entegrasyonları bölümünden bağlayın.');
                                                                    return;
                                                                }
                                                                const folder = await googleDrive.createFolder(arc.fullName || arc.id);
                                                                if (folder?.webViewLink) {
                                                                    window.open(folder.webViewLink, '_blank');
                                                                    toast.success('Drive klasörü oluşturuldu');
                                                                }
                                                            } catch (err) {
                                                                toast.error(err.message || 'Google Drive hatası');
                                                            }
                                                        }}
                                                    >
                                                        <HardDrive className="w-4 h-4 text-yellow-500" />
                                                    </button>
                                                    <button
                                                        className={`p-1.5 hover:bg-muted rounded ${(arc.folderPath || basePath) ? '' : 'opacity-50 cursor-not-allowed'}`}
                                                        title={(arc.folderPath || basePath) ? 'Klasörü Aç' : 'Klasör yolu ayarlanmamış'}
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            const folderPath = arc.folderPath || (basePath ? `${basePath}\\${arc.archiveNumber || arc.id}` : null);
                                                            if (folderPath && window.electron?.openFolder) {
                                                                const result = await window.electron.openFolder(folderPath);
                                                                if (!result.success) {
                                                                    toast.error(result.error || 'Klasör açılamadı');
                                                                }
                                                            } else if (!basePath) {
                                                                toast.error('Ayarlar > Genel > Arşiv Klasör Yolu ayarlanmalı');
                                                            }
                                                        }}
                                                        disabled={!arc.folderPath && !basePath}
                                                    >
                                                        <Folder className="w-4 h-4 text-orange-500" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Load More Button */}
                    {hasMore && !search && (
                        <div className="border-t border-border p-3 text-center shrink-0">
                            <button
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="px-6 py-2 text-sm font-medium bg-muted hover:bg-muted/80 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                {loadingMore ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Yükleniyor...
                                    </>
                                ) : (
                                    'Daha Fazla Yükle'
                                )}
                            </button>
                        </div>
                    )}
                </div>
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

            <ArchiveModal
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

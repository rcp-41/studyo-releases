/**
 * ArchiveDetailModal — Arşiv kaydı ekleme / düzenleme modal'ı.
 * Archives.jsx'ten ayrıştırıldı (Görev 4).
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { archivesApi, optionsApi, settingsApi, schoolsApi } from '../../services/api';
import { X, Loader2 } from 'lucide-react';
import PhoneInput from '../../components/PhoneInput';
import useF2Print from '../../hooks/useF2Print';
import useUndoable from '../../hooks/useUndoable';
import { autoPrintArchive, printTemplate } from '../../lib/printService';
import { getPrintSettings } from '../../lib/printSettings';
import notify from '../../lib/notify';

const WORKFLOW_STATUSES = {
    selection_pending: { label: 'Seçim Yapılacak', color: 'bg-yellow-500/15 text-yellow-600' },
    preparing: { label: 'Hazırlanıyor', color: 'bg-blue-500/15 text-blue-600' },
    printing: { label: 'Basılacak', color: 'bg-purple-500/15 text-purple-600' },
    ready: { label: 'Hazır', color: 'bg-green-500/15 text-green-600' },
    delivered: { label: 'Teslim Edildi', color: 'bg-gray-500/15 text-gray-500' }
};

const WORKFLOW_ORDER = ['selection_pending', 'preparing', 'printing', 'ready', 'delivered'];

export default function ArchiveDetailModal({ isOpen, onClose, archive }) {
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

    const runAutoPrint = useCallback(async (archiveDoc, formPayload) => {
        const settings = getPrintSettings();
        if (!settings.autoPrintOnSave) return;
        try {
            const archiveNum = archiveDoc?.archiveId || archiveDoc?.archiveNumber || formPayload?.archiveNumber;
            const photographerName = photographers?.find(p => p.id === formPayload.photographerId)?.fullName || '';
            const locationName = locations?.find(l => l.id === formPayload.locationId)?.name || '';
            const shootTypeName = shootTypes?.find(s => s.id === formPayload.shootTypeId)?.name || '';
            const total = Number(formPayload.totalAmount) || 0;
            const paid = (Number(formPayload.cashAmount) || 0) + (Number(formPayload.cardAmount) || 0) + (Number(formPayload.transferAmount) || 0);
            const printable = {
                archiveNumber: String(archiveNum || ''),
                fullName: formPayload.fullName,
                phone: formPayload.phone,
                email: formPayload.email,
                shootDate: formPayload.shootDate || new Date(),
                deliveryDate: formPayload.deliveryDate,
                size: formPayload.description1 || formPayload.ebat || '',
                photographer: photographerName,
                shootLocation: locationName,
                shootType: shootTypeName,
                totalAmount: total,
                paidAmount: paid,
                remainingAmount: total - paid,
                notes: formPayload.notes || formPayload.description2 || ''
            };
            const result = await autoPrintArchive(printable);
            if (!result?.skipped) {
                const failed = (result?.results || []).filter(r => !r.success);
                if (failed.length) {
                    notify.warning(`Yazdırma kısmen başarısız: ${failed.map(f => f.type).join(', ')}`);
                }
            }
        } catch (err) {
            console.error('[autoPrint] failed:', err);
        }
    }, [photographers, locations, shootTypes]);

    const createMutation = useMutation({
        mutationFn: (data) => archivesApi.create(data),
        onSuccess: async (response, variables) => {
            const arc = response || {};
            const archiveNum = arc.archiveId || arc.archiveNumber;
            runAutoPrint(arc, variables);

            if (archiveNum && window.electron?.createFolder) {
                try {
                    let basePath = settings?.general?.archive_base_path;
                    if (!basePath && window.electron?.getLicenseConfig) {
                        const config = await window.electron.getLicenseConfig().catch(() => null);
                        basePath = config?.studios?.[0]?.path || config?.archiveBasePath;
                    }
                    if (basePath) {
                        const folderPath = `${basePath}\\${archiveNum}`;
                        const result = await window.electron.createFolder(folderPath);
                        if (result.success && arc.id) {
                            archivesApi.update(arc.id, { folderPath }).catch(console.error);
                        }
                    }
                } catch (_) {
                    // Folder creation error — non-critical
                }
            }

            queryClient.invalidateQueries({ queryKey: ['archives'] });
            notify.success('Kayıt oluşturuldu');
            onClose();
        },
        onError: (error) => {
            console.error('Create archive error:', error);
            notify.error('Kayıt oluşturulamadı');
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data) => archivesApi.update(archive.id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['archives'] });
            notify.success('Kayıt güncellendi');
            runAutoPrint(archive, variables);
            onClose();
        },
        onError: (error) => { console.error('Update error:', error); notify.error('Kayıt güncellenemedi'); }
    });

    const deleteMutation = useMutation({
        mutationFn: () => archivesApi.delete(archive.id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['archives'] }); },
        onError: (error) => { console.error('Delete error:', error); notify.error('Kayıt silinemedi — değişiklikler geri alındı'); queryClient.invalidateQueries({ queryKey: ['archives'] }); }
    });

    const undoableDelete = useUndoable({
        onConfirm: () => deleteMutation.mutateAsync(),
        onUndo: () => {
            queryClient.invalidateQueries({ queryKey: ['archives'] });
        },
        message: `'${archive?.fullName || 'Kayıt'}' silindi — Geri Al`,
        delayMs: 8000
    });

    const handleDeleteClick = () => {
        if (!archive?.id) return;
        queryClient.setQueriesData({ queryKey: ['archives'] }, (old) => {
            if (!old) return old;
            if (Array.isArray(old)) return old.filter(x => x.id !== archive.id);
            if (Array.isArray(old.data)) return { ...old, data: old.data.filter(x => x.id !== archive.id) };
            if (Array.isArray(old.archives)) return { ...old, archives: old.archives.filter(x => x.id !== archive.id) };
            return old;
        });
        undoableDelete.trigger({ id: archive.id });
        onClose();
    };

    const handleSubmit = (e) => {
        if (e?.preventDefault) e.preventDefault();
        if (!formData.fullName || !formData.phone || !formData.shootTypeId || !formData.locationId || !formData.photographerId) {
            notify.error('Zorunlu alanları doldurun');
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

    useF2Print({
        enabled: isOpen && !createMutation.isPending && !updateMutation.isPending,
        onF2: () => handleSubmit()
    });

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
                            <div className={`text-center p-2 rounded-lg ${remaining > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
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
                            <button type="button" onClick={handleDeleteClick} disabled={deleteMutation.isPending} className="px-4 py-2 border border-destructive text-destructive rounded-lg hover:bg-destructive/10 disabled:opacity-50">
                                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sil'}
                            </button>
                        )}
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">İptal</button>
                        <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                            {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isEdit ? 'Güncelle' : 'Kaydet'}
                            <kbd className="hidden md:inline-block text-[10px] px-1 py-0.5 bg-white/20 rounded font-mono ml-1">F2</kbd>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

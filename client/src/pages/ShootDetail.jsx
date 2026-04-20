import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shootsApi, optionsApi, settingsApi } from '../services/api';
import { formatDate, formatDateTime, formatCurrency, getStatusLabel, getShootTypeLabel, getInitials, cn } from '../lib/utils';
import {
    ArrowLeft, Camera, Calendar, MapPin, DollarSign, User, Package, Clock,
    Edit, Trash2, CheckCircle, Loader2, Play, Pause, AlertCircle, X,
    Undo2, UserCog, Image, FolderOpen, ChevronDown, Printer
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '../components/ConfirmDialog';
import { SkeletonCard } from '../components/Skeleton';
import useF2Print from '../hooks/useF2Print';
import { printTemplate, isPrintAvailable } from '../lib/printService';
import { getPrintSettings } from '../lib/printSettings';

const workflowStages = [
    { key: 'confirmed', label: 'Onay', icon: CheckCircle },
    { key: 'shot_done', label: 'Çekim', icon: Camera },
    { key: 'editing', label: 'Düzenleme', icon: Edit },
    { key: 'client_selection', label: 'Seçim', icon: User },
    { key: 'payment_complete', label: 'Ödeme', icon: DollarSign },
    { key: 'delivered', label: 'Teslim', icon: Package }
];

// ==================== PHOTOGRAPHER SELECTOR ====================
function PhotographerSelector({ currentPhotographer, onSelect }) {
    const [open, setOpen] = useState(false);
    const { data: photographers } = useQuery({
        queryKey: ['photographers'],
        queryFn: () => optionsApi.getPhotographers().then(r => r.data),
        enabled: open
    });

    return (
        <div className="relative inline-block">
            <button
                onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-sm rounded hover:bg-muted transition-colors"
                title="Fotoğrafçı Değiştir"
            >
                <span className="font-medium">{currentPhotographer?.fullName || 'Atanmadı'}</span>
                <UserCog className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            {open && (
                <div className="absolute z-20 top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[180px]">
                    {photographers?.map(p => (
                        <button
                            key={p.id}
                            onClick={() => { onSelect(p.id); setOpen(false); }}
                            className={cn(
                                'w-full text-left px-3 py-1.5 text-sm hover:bg-muted',
                                currentPhotographer?.id === p.id && 'bg-muted font-medium'
                            )}
                        >
                            {p.name || p.fullName}
                        </button>
                    ))}
                    {!photographers?.length && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">Fotoğrafçı yok</p>
                    )}
                </div>
            )}
        </div>
    );
}

// ==================== PHOTO GALLERY ====================
function PhotoGallery({ archiveNumber, photoSelectionData }) {
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lightbox, setLightbox] = useState(null);

    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsApi.getAll().then(r => r.data)
    });

    const basePath = settings?.general?.archiveFolderPath || '';

    const loadPhotos = async () => {
        if (!basePath || !archiveNumber) {
            toast.error('Arşiv klasör yolu ayarlanmamış');
            return;
        }
        setLoading(true);
        try {
            const folderPath = `${basePath}\\${archiveNumber}`;
            if (window.electron?.listPhotos) {
                const result = await window.electron.listPhotos(folderPath);
                if (result.success) {
                    setPhotos(result.files || []);
                    if (!result.files?.length) toast('Klasörde fotoğraf bulunamadı');
                } else {
                    toast.error(result.error || 'Fotoğraflar yüklenemedi');
                }
            } else {
                // Fallback: open folder
                if (window.electron?.openFolder) {
                    await window.electron.openFolder(folderPath);
                }
            }
        } catch (e) {
            toast.error('Fotoğraf yükleme hatası');
        }
        setLoading(false);
    };

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Image className="w-5 h-5" /> Fotoğraflar
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={loadPhotos}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                        Fotoğrafları Yükle
                    </button>
                    {basePath && (
                        <button
                            onClick={async () => {
                                const folderPath = `${basePath}\\${archiveNumber}`;
                                if (window.electron?.openFolder) await window.electron.openFolder(folderPath);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80"
                        >
                            <FolderOpen className="w-4 h-4" /> Klasörü Aç
                        </button>
                    )}
                </div>
            </div>

            {photos.length > 0 ? (
                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                    {photos.map((photo, i) => {
                        const fileName = photo.name || photo.path?.split(/[/\\]/).pop();
                        const selectedInfo = photoSelectionData?.selectedPhotos?.find(
                            sp => String(sp.photoId) === fileName || String(sp.photoId) === String(i)
                        );
                        const isNumbered = selectedInfo && !selectedInfo.isCancelled;

                        return (
                            <div
                                key={i}
                                className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-all ${isNumbered ? 'ring-2 ring-amber-400' : 'hover:ring-2 hover:ring-primary'}`}
                                onClick={() => setLightbox(photo)}
                            >
                                <img src={photo.thumbnail || photo.path} alt="" className="w-full h-full object-cover" />
                                {isNumbered && (
                                    <div className="absolute top-1.5 right-1.5 bg-amber-500 text-black font-bold text-xs w-6 h-6 flex items-center justify-center rounded-full shadow border-2 border-neutral-900 shadow-black/50">
                                        {selectedInfo.orderNumber}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="text-center py-6 text-muted-foreground text-sm">
                    "Fotoğrafları Yükle" butonuna tıklayarak klasördeki fotoğrafları görüntüleyin
                </p>
            )}

            {/* Lightbox */}
            {lightbox && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
                    onClick={() => setLightbox(null)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') setLightbox(null);
                        if (e.key === 'ArrowRight') {
                            const idx = photos.findIndex(p => p.path === lightbox.path);
                            if (idx < photos.length - 1) setLightbox(photos[idx + 1]);
                        }
                        if (e.key === 'ArrowLeft') {
                            const idx = photos.findIndex(p => p.path === lightbox.path);
                            if (idx > 0) setLightbox(photos[idx - 1]);
                        }
                    }}
                    tabIndex={0}
                    ref={(el) => el?.focus()}
                >
                    <button className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-lg z-10"
                        onClick={(e) => { e.stopPropagation(); setLightbox(null); }}>
                        <X className="w-6 h-6" />
                    </button>
                    {/* Prev button */}
                    {photos.findIndex(p => p.path === lightbox.path) > 0 && (
                        <button
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white hover:bg-white/20 rounded-full z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                const idx = photos.findIndex(p => p.path === lightbox.path);
                                setLightbox(photos[idx - 1]);
                            }}
                        >
                            <ChevronDown className="w-8 h-8 -rotate-90" />
                        </button>
                    )}
                    {/* Next button */}
                    {photos.findIndex(p => p.path === lightbox.path) < photos.length - 1 && (
                        <button
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white hover:bg-white/20 rounded-full z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                const idx = photos.findIndex(p => p.path === lightbox.path);
                                setLightbox(photos[idx + 1]);
                            }}
                        >
                            <ChevronDown className="w-8 h-8 rotate-90" />
                        </button>
                    )}
                    <img src={lightbox.path} alt="" className="max-w-[90vw] max-h-[90vh] object-contain select-none" draggable={false} />
                    {/* Counter */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
                        {photos.findIndex(p => p.path === lightbox.path) + 1} / {photos.length}
                    </div>
                </div>
            )}
        </div>
    );
}

// ==================== MAIN COMPONENT ====================
export default function ShootDetail() {
    const { id } = useParams();
    const queryClient = useQueryClient();
    const [showEdit, setShowEdit] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [confirmRollback, setConfirmRollback] = useState(false);

    const { data: shoot, isLoading } = useQuery({
        queryKey: ['shoot', id],
        queryFn: () => shootsApi.get(id).then(res => res.data)
    });

    const statusMutation = useMutation({
        mutationFn: ({ status, workflowStage }) => shootsApi.updateStatus(id, status, workflowStage),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shoot', id] });
            toast.success('Durum güncellendi');
        }
    });

    const photographerMutation = useMutation({
        mutationFn: (photographerId) => shootsApi.assignPhotographer(id, photographerId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shoot', id] });
            toast.success('Fotoğrafçı atandı');
        },
        onError: () => toast.error('Fotoğrafçı atanamadı')
    });

    const getStageIndex = () => {
        const idx = workflowStages.findIndex(s => s.key === shoot?.status);
        return idx >= 0 ? idx : -1;
    };

    const printShootDocs = async () => {
        if (!shoot || !isPrintAvailable()) {
            toast.error('Yazdırma servisi kullanılamıyor');
            return;
        }
        const settings = getPrintSettings();
        const types = ['receipt', 'smallEnvelope', 'bigEnvelope'].filter(t => settings.enabled?.[t]);
        if (types.length === 0) {
            toast.error('Hiçbir şablon aktif değil. Ayarlar > Yazdırma');
            return;
        }
        const printable = {
            archiveNumber: shoot.archiveNumber || shoot.shootCode,
            fullName: shoot.customer?.fullName,
            phone: shoot.customer?.phone,
            email: shoot.customer?.email,
            shootDate: shoot.shootDate,
            deliveryDate: shoot.deliveryDate,
            size: (shoot.packageItems || []).map(p => p.name || p.description).filter(Boolean).join(' + '),
            photographer: shoot.photographer?.fullName,
            shootLocation: shoot.location?.name,
            shootType: shoot.shootType?.name,
            totalAmount: shoot.totalAmount,
            paidAmount: shoot.paidAmount,
            remainingAmount: shoot.remainingAmount,
            notes: shoot.notes
        };
        toast.loading('Yazdırılıyor...', { id: 'print-shoot' });
        for (const type of types) {
            await printTemplate(type, printable);
        }
        toast.success(`${types.length} şablon yazdırıldı`, { id: 'print-shoot' });
    };

    useF2Print({
        enabled: !!shoot && !showEdit && !showPayment,
        onF2: printShootDocs
    });

    const advanceStage = () => {
        const currentIdx = getStageIndex();
        if (currentIdx < workflowStages.length - 1) {
            const nextStage = workflowStages[currentIdx + 1];
            statusMutation.mutate({ status: nextStage.key, workflowStage: nextStage.key });
        }
    };

    const rollbackStage = () => {
        const currentIdx = getStageIndex();
        if (currentIdx > 0) {
            setConfirmRollback(true);
        }
    };

    const performRollback = () => {
        const currentIdx = getStageIndex();
        if (currentIdx > 0) {
            const prevStage = workflowStages[currentIdx - 1];
            statusMutation.mutate({ status: prevStage.key, workflowStage: prevStage.key }, {
                onSettled: () => setConfirmRollback(false)
            });
        } else {
            setConfirmRollback(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <SkeletonCard />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <SkeletonCard className="lg:col-span-2 h-64" />
                    <SkeletonCard className="h-64" />
                </div>
            </div>
        );
    }

    if (!shoot) {
        return (
            <div className="text-center py-12">
                <p className="text-lg">Çekim bulunamadı</p>
                <Link to="/shoots" className="text-primary hover:underline">Çekimlere dön</Link>
            </div>
        );
    }

    const currentStageIdx = getStageIndex();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/shoots" className="p-2 rounded-lg hover:bg-muted">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">{shoot.shootCode}</h1>
                        <p className="text-muted-foreground">{getShootTypeLabel(shoot.shootType)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Rollback Button */}
                    {currentStageIdx > 0 && (
                        <button
                            onClick={rollbackStage}
                            disabled={statusMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                        >
                            <Undo2 className="w-4 h-4" />
                            Geri Al
                        </button>
                    )}
                    {/* Advance Button */}
                    {currentStageIdx < workflowStages.length - 1 && (
                        <button
                            onClick={advanceStage}
                            disabled={statusMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                            <Play className="w-4 h-4" />
                            İleri Al
                        </button>
                    )}
                    {isPrintAvailable() && (
                        <button onClick={printShootDocs} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted" title="Fiş + Zarf yazdır (F2)">
                            <Printer className="w-4 h-4" />
                            Yazdır
                            <kbd className="hidden md:inline-block text-[10px] px-1 py-0.5 bg-muted rounded font-mono">F2</kbd>
                        </button>
                    )}
                    <button onClick={() => setShowEdit(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                        <Edit className="w-4 h-4" />
                        Düzenle
                    </button>
                </div>
            </div>

            {/* Workflow Progress */}
            <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">İş Akışı</h2>
                <div className="flex items-center justify-between">
                    {workflowStages.map((stage, idx) => {
                        const Icon = stage.icon;
                        const isCompleted = idx <= currentStageIdx;
                        const isCurrent = idx === currentStageIdx;

                        return (
                            <div key={stage.key} className="flex flex-col items-center flex-1">
                                <div className="flex items-center w-full">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center ${isCompleted
                                            ? 'bg-green-600 text-white'
                                            : 'bg-muted text-muted-foreground'
                                            } ${isCurrent ? 'ring-4 ring-green-600/30' : ''}`}
                                    >
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    {idx < workflowStages.length - 1 && (
                                        <div
                                            className={`flex-1 h-1 mx-2 rounded ${idx < currentStageIdx ? 'bg-green-600' : 'bg-muted'
                                                }`}
                                        />
                                    )}
                                </div>
                                <span className={`text-xs mt-2 ${isCompleted ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                                    {stage.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Details Card */}
                    <div className="bg-card border border-border rounded-xl p-6">
                        <h2 className="text-lg font-semibold mb-4">Çekim Detayları</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Müşteri</p>
                                <Link to={`/customers/${shoot.customer?.id}`} className="font-medium hover:text-primary">
                                    {shoot.customer?.fullName}
                                </Link>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Çekim Tarihi</p>
                                <p className="font-medium">{formatDateTime(shoot.shootDate)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Lokasyon</p>
                                <p className="font-medium">{shoot.location || 'Stüdyo'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Paket</p>
                                <p className="font-medium">{shoot.package?.name || '-'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Fotoğrafçı</p>
                                <PhotographerSelector
                                    currentPhotographer={shoot.photographer}
                                    onSelect={(photographerId) => photographerMutation.mutate(photographerId)}
                                />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Durum</p>
                                <span className={`px-2 py-1 rounded text-xs font-medium status-${shoot.status}`}>
                                    {getStatusLabel(shoot.status)}
                                </span>
                            </div>
                        </div>
                        {shoot.notes && (
                            <div className="mt-4 pt-4 border-t border-border">
                                <p className="text-sm text-muted-foreground">Notlar</p>
                                <p className="mt-1">{shoot.notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Photo Gallery */}
                    <PhotoGallery archiveNumber={shoot.archiveNumber || shoot.shootCode} photoSelectionData={shoot.photoSelectionData} />
                </div>

                {/* Payment Card */}
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-xl p-6">
                        <h2 className="text-lg font-semibold mb-4">Ödeme Bilgileri</h2>
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Toplam</span>
                                <span className="font-semibold">{formatCurrency(shoot.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Ödenen</span>
                                <span className="text-green-600">{formatCurrency(shoot.paidAmount)}</span>
                            </div>
                            <div className="flex justify-between border-t border-border pt-4">
                                <span className="text-muted-foreground">Kalan</span>
                                <span className={shoot.remainingAmount > 0 ? 'text-destructive font-semibold' : 'text-green-600'}>
                                    {formatCurrency(shoot.remainingAmount)}
                                </span>
                            </div>

                            {shoot.remainingAmount > 0 && (
                                <button onClick={() => setShowPayment(true)} className="w-full mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                                    <DollarSign className="w-4 h-4 inline mr-2" />
                                    Ödeme Al
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Payment History */}
                    {shoot.payments?.length > 0 && (
                        <div className="bg-card border border-border rounded-xl p-6">
                            <h2 className="text-sm font-semibold mb-3">Ödeme Geçmişi</h2>
                            <div className="space-y-2">
                                {shoot.payments.map((p, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm">
                                        <div>
                                            <span className="text-xs text-muted-foreground">
                                                {p.date ? formatDate(p.date) : '-'}
                                            </span>
                                            <p className="text-xs text-muted-foreground capitalize">
                                                {p.method === 'cash' ? 'Nakit' : p.method === 'credit_card' ? 'Kart' : 'Havale'}
                                            </p>
                                        </div>
                                        <span className="font-medium text-green-600">{formatCurrency(p.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {showEdit && (
                <EditShootModal
                    shoot={shoot}
                    onClose={() => setShowEdit(false)}
                    onSave={() => { queryClient.invalidateQueries({ queryKey: ['shoot', id] }); setShowEdit(false); }}
                />
            )}

            {/* Payment Modal */}
            {showPayment && (
                <PaymentModal
                    shoot={shoot}
                    onClose={() => setShowPayment(false)}
                    onSave={() => { queryClient.invalidateQueries({ queryKey: ['shoot', id] }); setShowPayment(false); }}
                />
            )}

            <ConfirmDialog
                open={confirmRollback}
                onOpenChange={(o) => !o && setConfirmRollback(false)}
                title="Aşamayı geri al"
                description="Aşamayı geri almak istediğinizden emin misiniz?"
                destructive={false}
                confirmText="Geri Al"
                cancelText="Vazgeç"
                onConfirm={performRollback}
                loading={statusMutation.isPending}
            />
        </div>
    );
}

// ==================== EDIT SHOOT MODAL ====================
function EditShootModal({ shoot, onClose, onSave }) {
    const [formData, setFormData] = useState({
        location: shoot.location || '',
        notes: shoot.notes || '',
        totalAmount: shoot.totalAmount || 0
    });

    const updateMutation = useMutation({
        mutationFn: (data) => shootsApi.update(shoot.id, data),
        onSuccess: () => { toast.success('Çekim güncellendi'); onSave(); },
        onError: () => toast.error('Güncelleme başarısız')
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Çekim Düzenle</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={e => { e.preventDefault(); updateMutation.mutate(formData); }} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Lokasyon</label>
                        <input type="text" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Toplam Tutar (₺)</label>
                        <input type="number" value={formData.totalAmount} onChange={e => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Notlar</label>
                        <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none resize-none" rows={3} />
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

// ==================== PAYMENT MODAL ====================
function PaymentModal({ shoot, onClose, onSave }) {
    const [amount, setAmount] = useState(shoot.remainingAmount || 0);
    const [method, setMethod] = useState('cash');
    const [note, setNote] = useState('');

    const paymentMutation = useMutation({
        mutationFn: (data) => shootsApi.addPayment(shoot.id, data),
        onSuccess: () => { toast.success('Ödeme kaydedildi'); onSave(); },
        onError: () => toast.error('Ödeme kaydedilemedi')
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Ödeme Al</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <div className="mb-4 p-3 bg-muted rounded-lg text-sm">
                    <div className="flex justify-between"><span>Toplam:</span><span className="font-medium">{formatCurrency(shoot.totalAmount)}</span></div>
                    <div className="flex justify-between"><span>Ödenen:</span><span className="text-green-600">{formatCurrency(shoot.paidAmount)}</span></div>
                    <div className="flex justify-between border-t border-border pt-2 mt-2"><span>Kalan:</span><span className="font-semibold text-destructive">{formatCurrency(shoot.remainingAmount)}</span></div>
                </div>
                <form onSubmit={e => { e.preventDefault(); paymentMutation.mutate({ amount, method, note }); }} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Tutar (₺)</label>
                        <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))}
                            max={shoot.remainingAmount}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Ödeme Yöntemi</label>
                        <select value={method} onChange={e => setMethod(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none">
                            <option value="cash">Nakit</option>
                            <option value="credit_card">Kredi Kartı</option>
                            <option value="transfer">Havale/EFT</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Not</label>
                        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Ödeme notu..."
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none" />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">İptal</button>
                        <button type="submit" disabled={paymentMutation.isPending}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                            {paymentMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Ödemeyi Kaydet
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

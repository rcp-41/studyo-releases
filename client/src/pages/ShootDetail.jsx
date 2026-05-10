import { useState } from 'react';
import notify from '../lib/notify';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shootsApi } from '../services/api';
import { formatDate, formatDateTime, formatCurrency, getStatusLabel, getShootTypeLabel } from '../lib/utils';
import {
    ArrowLeft, Camera, DollarSign, User, Package, Clock,
    Edit, CheckCircle, Loader2, Play, Undo2
} from 'lucide-react';
import { Printer } from 'lucide-react';

import ConfirmDialog from '../components/ConfirmDialog';
import { SkeletonCard } from '../components/Skeleton';
import useF2Print from '../hooks/useF2Print';
import { printTemplate, isPrintAvailable } from '../lib/printService';
import { getPrintSettings } from '../lib/printSettings';

import PhotographerSelector from './shoot-detail/PhotographerSelector';
import PhotoGallery from './shoot-detail/PhotoGallery';
import { EditShootModal, PaymentModal } from './shoot-detail/ShootModals';

const workflowStages = [
    { key: 'confirmed', label: 'Onay', icon: CheckCircle },
    { key: 'shot_done', label: 'Çekim', icon: Camera },
    { key: 'editing', label: 'Düzenleme', icon: Edit },
    { key: 'client_selection', label: 'Seçim', icon: User },
    { key: 'payment_complete', label: 'Ödeme', icon: DollarSign },
    { key: 'delivered', label: 'Teslim', icon: Package }
];

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
            notify.success('Durum güncellendi');
        }
    });

    const photographerMutation = useMutation({
        mutationFn: (photographerId) => shootsApi.assignPhotographer(id, photographerId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shoot', id] });
            notify.success('Fotoğrafçı atandı');
        },
        onError: () => notify.error('Fotoğrafçı atanamadı')
    });

    const getStageIndex = () => {
        const idx = workflowStages.findIndex(s => s.key === shoot?.status);
        return idx >= 0 ? idx : -1;
    };

    const printShootDocs = async () => {
        if (!shoot || !isPrintAvailable()) {
            notify.error('Yazdırma servisi kullanılamıyor');
            return;
        }
        const settings = getPrintSettings();
        const types = ['receipt', 'smallEnvelope', 'bigEnvelope'].filter(t => settings.enabled?.[t]);
        if (types.length === 0) {
            notify.error('Hiçbir şablon aktif değil. Ayarlar > Yazdırma');
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
        notify.loading('Yazdırılıyor...', { id: 'print-shoot' });
        for (const type of types) {
            await printTemplate(type, printable);
        }
        notify.success(`${types.length} şablon yazdırıldı`, { id: 'print-shoot' });
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
        if (getStageIndex() > 0) setConfirmRollback(true);
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
                                            className={`flex-1 h-1 mx-2 rounded ${idx < currentStageIdx ? 'bg-green-600' : 'bg-muted'}`}
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

            {showEdit && (
                <EditShootModal
                    shoot={shoot}
                    onClose={() => setShowEdit(false)}
                    onSave={() => { queryClient.invalidateQueries({ queryKey: ['shoot', id] }); setShowEdit(false); }}
                />
            )}

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

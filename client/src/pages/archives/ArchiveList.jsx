/**
 * ArchiveList — Arşiv tablosu + Load More.
 * Archives.jsx'ten ayrıştırıldı (Görev 4).
 *
 * Props:
 *   archives         — filtrelenmiş arşiv kayıtları
 *   isLoading        — ilk yükleme skeleton
 *   hasMore          — daha fazla kayıt var mı
 *   search           — aktif arama terimi (load more'u gizlemek için)
 *   loadingMore      — load more işlemi sürüyor mu
 *   hasActiveFilters — temizle butonu gösterimi için
 *   basePath         — klasör açma yolu
 *   workflowPopup    — açık durum popup'ının arc.id'si
 *   onDoubleClick(arc)
 *   onWorkflowClick(e, arc)
 *   onAdvanceWorkflow(arcId, newStatus)
 *   onWhatsApp(arc)
 *   onWooCommerce(arc)
 *   onNavigateCustomer(arc)
 *   onClearFilters()
 *   onLoadMore()
 */

import { format } from 'date-fns';
import { Archive, Loader2, MessageCircle, Globe, HardDrive, Folder, UserCircle, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import notify from '../../lib/notify';
import { isPrintAvailable, printTemplate } from '../../lib/printService';
import { getPrintSettings } from '../../lib/printSettings';

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

export default function ArchiveList({
    archives,
    isLoading,
    hasMore,
    search,
    loadingMore,
    hasActiveFilters,
    basePath,
    workflowPopup,
    onDoubleClick,
    onWorkflowClick,
    onAdvanceWorkflow,
    onWhatsApp,
    onWooCommerce,
    onClearFilters,
    onLoadMore,
}) {
    const navigate = useNavigate();

    return (
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
                            Array.from({ length: 6 }).map((_, i) => (
                                <tr key={`sk-${i}`}>
                                    {Array.from({ length: 7 }).map((_, c) => (
                                        <td key={c} className="px-3 py-3 border-r border-border last:border-r-0">
                                            <div className="h-4 bg-muted/60 rounded animate-pulse" style={{ width: c === 0 ? '3rem' : c === 6 ? '5rem' : '100%' }} />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : archives.length === 0 ? (
                            <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                                <div className="flex flex-col items-center gap-2">
                                    <Archive className="w-8 h-8 opacity-40" />
                                    <p>{hasActiveFilters || search ? 'Filtrelere uygun kayıt bulunamadı' : 'Henüz kayıt yok'}</p>
                                    {hasActiveFilters && (
                                        <button onClick={onClearFilters} className="text-xs text-primary hover:underline">Filtreleri Temizle</button>
                                    )}
                                </div>
                            </td></tr>
                        ) : (
                            archives.map(arc => (
                                <tr
                                    key={arc.id}
                                    className="hover:bg-muted/30 cursor-pointer"
                                    onDoubleClick={() => onDoubleClick(arc)}
                                >
                                    <td className="px-3 py-2 font-mono text-xs border-r border-border">{arc.archiveNumber || `#${archives.indexOf(arc) + 1}`}</td>
                                    <td className="px-3 py-2 font-medium border-r border-border">
                                        <div>{arc.fullName}</div>
                                        <div className="flex gap-2 mt-1">
                                            <div className="relative">
                                                <button onClick={(e) => onWorkflowClick(e, arc)} title="Durumu değiştir"><WorkflowBadge status={arc.workflowStatus} /></button>
                                                {workflowPopup === arc.id && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onWorkflowClick(e, arc); }} />
                                                        <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl p-1.5 min-w-[140px]">
                                                            {WORKFLOW_ORDER.map(key => {
                                                                const ws = WORKFLOW_STATUSES[key];
                                                                const isActive = (arc.workflowStatus || 'selection_pending') === key;
                                                                return (
                                                                    <button
                                                                        key={key}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onAdvanceWorkflow(arc.id, key);
                                                                        }}
                                                                        className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition-colors ${isActive ? ws.color : 'hover:bg-muted text-muted-foreground'}`}
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
                                            {isPrintAvailable() && (
                                                <button
                                                    className="p-1.5 hover:bg-muted rounded text-cyan-500 hover:text-cyan-600"
                                                    title="Yazdır (Fiş + Zarf)"
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        const settings = getPrintSettings();
                                                        const printable = {
                                                            archiveNumber: arc.archiveNumber || arc.archiveId,
                                                            fullName: arc.fullName,
                                                            phone: arc.phone,
                                                            email: arc.email,
                                                            shootDate: arc.shootDate,
                                                            deliveryDate: arc.deliveryDate,
                                                            size: arc.description1 || '',
                                                            photographer: arc.photographer?.fullName,
                                                            shootLocation: arc.location?.name,
                                                            shootType: arc.shootType?.name,
                                                            totalAmount: arc.totalAmount,
                                                            paidAmount: (arc.cashAmount || 0) + (arc.cardAmount || 0) + (arc.transferAmount || 0),
                                                            remainingAmount: (arc.totalAmount || 0) - ((arc.cashAmount || 0) + (arc.cardAmount || 0) + (arc.transferAmount || 0)),
                                                            notes: arc.description2 || ''
                                                        };
                                                        const types = ['receipt', 'smallEnvelope', 'bigEnvelope'].filter(t => settings.enabled?.[t]);
                                                        if (types.length === 0) {
                                                            notify.error('Hiçbir şablon aktif değil. Ayarlar > Yazdırma.');
                                                            return;
                                                        }
                                                        notify.loading('Yazdırılıyor...', { id: 'print-row' });
                                                        for (const type of types) {
                                                            await printTemplate(type, printable);
                                                        }
                                                        notify.success(`${types.length} şablon yazdırıldı`, { id: 'print-row' });
                                                    }}
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                            )}
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
                                                onClick={(e) => { e.stopPropagation(); onWhatsApp(arc); }}
                                            >
                                                <MessageCircle className="w-4 h-4" />
                                            </button>
                                            <button
                                                className="p-1.5 hover:bg-muted rounded text-blue-500 hover:text-blue-600"
                                                title="WooCommerce"
                                                onClick={(e) => { e.stopPropagation(); onWooCommerce(arc); }}
                                            >
                                                <Globe className="w-4 h-4" />
                                            </button>
                                            <button
                                                className="p-1.5 hover:bg-muted rounded"
                                                title="Google Drive'a Yükle"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    try {
                                                        const { googleDrive } = await import('../../services/googleDrive');
                                                        if (!googleDrive.isAvailable()) {
                                                            notify.error('Google Drive sadece masaüstü uygulamasında kullanılabilir');
                                                            return;
                                                        }
                                                        const status = await googleDrive.getStatus();
                                                        if (!status.connected) {
                                                            notify.error('Google Drive bağlı değil. Ayarlar > API Entegrasyonları bölümünden bağlayın.');
                                                            return;
                                                        }
                                                        const folder = await googleDrive.createFolder(arc.fullName || arc.id);
                                                        if (folder?.webViewLink) {
                                                            window.open(folder.webViewLink, '_blank');
                                                            notify.success('Drive klasörü oluşturuldu');
                                                        }
                                                    } catch (err) {
                                                        notify.error(err.message || 'Google Drive hatası');
                                                    }
                                                }}
                                            >
                                                <HardDrive className="w-4 h-4 text-yellow-500" />
                                            </button>
                                            <button
                                                className={`p-1.5 hover:bg-muted rounded ${(arc.folderPath || basePath) ? '' : 'opacity-50 cursor-not-allowed'}`}
                                                title={(arc.folderPath || basePath) ? 'Klasörü Aç' : 'Klasör yolu ayarlanmamış'}
                                                disabled={!arc.folderPath && !basePath}
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const folderPath = arc.folderPath || (basePath ? `${basePath}\\${arc.archiveNumber || arc.id}` : null);
                                                    if (folderPath && window.electron?.openFolder) {
                                                        if (basePath && window.electron?.addAllowedPath) {
                                                            await window.electron.addAllowedPath(basePath);
                                                        }
                                                        const result = await window.electron.openFolder(folderPath);
                                                        if (!result.success) {
                                                            notify.error(result.error || 'Klasör açılamadı');
                                                        }
                                                    } else if (!basePath) {
                                                        notify.error('Ayarlar > Genel > Arşiv Klasör Yolu ayarlanmalı');
                                                    }
                                                }}
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

            {hasMore && !search && (
                <div className="border-t border-border p-3 text-center shrink-0">
                    <button
                        onClick={onLoadMore}
                        disabled={loadingMore}
                        className="px-6 py-2 text-sm font-medium bg-muted hover:bg-muted/80 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        {loadingMore ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor...</>
                        ) : 'Daha Fazla Yükle'}
                    </button>
                </div>
            )}
        </div>
    );
}

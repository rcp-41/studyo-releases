import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { shootsApi, packagesApi, customersApi } from '../services/api';
import { formatDate, formatCurrency, getStatusLabel, getShootTypeLabel, cn } from '../lib/utils';
import {
    Plus,
    Search,
    Filter,
    Camera,
    Calendar,
    DollarSign,
    Loader2,
    ChevronLeft,
    ChevronRight,
    X,
    CalendarRange
} from 'lucide-react';
import { toast } from 'sonner';
import { SkeletonList } from '../components/Skeleton';

const statusFilters = [
    { value: '', label: 'Tümü' },
    { value: 'new', label: 'Yeni' },
    { value: 'confirmed', label: 'Onaylı' },
    { value: 'shot_done', label: 'Çekim Tamam' },
    { value: 'editing', label: 'Düzenleniyor' },
    { value: 'client_selection', label: 'Müşteri Seçimi' },
    { value: 'payment_pending', label: 'Ödeme Bekliyor' },
    { value: 'payment_complete', label: 'Ödeme Tamamlandı' },
    { value: 'delivered', label: 'Teslim Edildi' }
];

// Shoot Card
function ShootCard({ shoot }) {
    return (
        <Link
            to={`/shoots/${shoot.id}`}
            className="bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:border-primary/50 transition-all"
        >
            <div className="flex items-start justify-between mb-3">
                <div>
                    <h3 className="font-semibold">{shoot.shootCode}</h3>
                    <p className="text-sm text-muted-foreground">
                        {shoot.customer?.fullName}
                    </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium status-${shoot.status}`}>
                    {getStatusLabel(shoot.status)}
                </span>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    <span>{getShootTypeLabel(shoot.shootType)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(shoot.shootDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    <span>{formatCurrency(shoot.totalAmount)}</span>
                    {shoot.remainingAmount > 0 && (
                        <span className="text-destructive">
                            ({formatCurrency(shoot.remainingAmount)} kalan)
                        </span>
                    )}
                </div>
            </div>

            {shoot.package && (
                <div className="mt-3 pt-3 border-t border-border">
                    <span className="text-sm bg-muted px-2 py-1 rounded">
                        {shoot.package.name}
                    </span>
                </div>
            )}
        </Link>
    );
}

// Add Shoot Modal
function AddShootModal({ isOpen, onClose }) {
    const [formData, setFormData] = useState({
        customerId: '',
        packageId: '',
        shootType: 'portrait',
        shootDate: '',
        location: '',
        totalAmount: '',
        advancePayment: '0',
        notes: ''
    });
    const [customerSearch, setCustomerSearch] = useState('');

    const queryClient = useQueryClient();

    const { data: customers } = useQuery({
        queryKey: ['customers', 'search', customerSearch],
        queryFn: () => customersApi.search(customerSearch).then(res => res.data),
        enabled: customerSearch.length >= 2
    });

    const { data: packages } = useQuery({
        queryKey: ['packages'],
        queryFn: () => packagesApi.list({ activeOnly: true }).then(res => res.data)
    });

    const createMutation = useMutation({
        mutationFn: (data) => shootsApi.create({
            ...data,
            customerId: parseInt(data.customerId),
            packageId: data.packageId ? parseInt(data.packageId) : null,
            totalAmount: parseFloat(data.totalAmount) || 0,
            advancePayment: parseFloat(data.advancePayment) || 0
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shoots'] });
            toast.success('Çekim oluşturuldu');
            onClose();
        },
        onError: (error) => {
            toast.error(error.response?.data?.error || 'Hata oluştu');
        }
    });

    const handlePackageSelect = (packageId) => {
        const pkg = packages?.data?.find(p => p.id === parseInt(packageId));
        if (pkg) {
            setFormData({
                ...formData,
                packageId,
                totalAmount: pkg.basePrice.toString()
            });
        } else {
            setFormData({ ...formData, packageId, totalAmount: '' });
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.customerId || !formData.shootDate || !formData.totalAmount) {
            toast.error('Müşteri, tarih ve tutar zorunludur');
            return;
        }
        createMutation.mutate(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Yeni Çekim</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Customer Search */}
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Müşteri *</label>
                        <input
                            type="text"
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            placeholder="Müşteri ara..."
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                        />
                        {customers?.length > 0 && (
                            <div className="mt-2 bg-background border border-border rounded-lg max-h-40 overflow-y-auto">
                                {customers.map((c) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => {
                                            setFormData({ ...formData, customerId: c.id.toString() });
                                            setCustomerSearch(c.fullName);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                                    >
                                        {c.fullName} - {c.phone}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Shoot Type */}
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Çekim Türü *</label>
                        <select
                            value={formData.shootType}
                            onChange={(e) => setFormData({ ...formData, shootType: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                        >
                            <option value="wedding">Düğün</option>
                            <option value="engagement">Nişan</option>
                            <option value="baby">Bebek</option>
                            <option value="portrait">Portre</option>
                            <option value="corporate">Kurumsal</option>
                            <option value="product">Ürün</option>
                            <option value="event">Etkinlik</option>
                            <option value="other">Diğer</option>
                        </select>
                    </div>

                    {/* Package */}
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Paket</label>
                        <select
                            value={formData.packageId}
                            onChange={(e) => handlePackageSelect(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                        >
                            <option value="">Paket seçin (isteğe bağlı)</option>
                            {packages?.data?.map((pkg) => (
                                <option key={pkg.id} value={pkg.id}>
                                    {pkg.name} - {formatCurrency(pkg.basePrice)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Çekim Tarihi *</label>
                        <input
                            type="datetime-local"
                            value={formData.shootDate}
                            onChange={(e) => setFormData({ ...formData, shootDate: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                        />
                    </div>

                    {/* Location */}
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Lokasyon</label>
                        <input
                            type="text"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            placeholder="Stüdyo / Dış Mekan"
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                        />
                    </div>

                    {/* Amount */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1.5">Toplam Tutar *</label>
                            <input
                                type="number"
                                value={formData.totalAmount}
                                onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                                placeholder="0"
                                className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1.5">Kapora</label>
                            <input
                                type="number"
                                value={formData.advancePayment}
                                onChange={(e) => setFormData({ ...formData, advancePayment: e.target.value })}
                                placeholder="0"
                                className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Notlar</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Kaydet
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function Shoots() {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const [showAddModal, setShowAddModal] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showDateFilter, setShowDateFilter] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['shoots', { page, status, search }],
        queryFn: () => shootsApi.list({ page, limit: 12, status, search }).then(res => res.data)
    });

    const shoots = data?.data || [];
    const pagination = data?.pagination || { total: 0, pages: 1 };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Çekimler</h1>
                    <p className="text-muted-foreground">{pagination.total} çekim kaydı</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                    <Plus className="w-5 h-5" />
                    Yeni Çekim
                </button>
            </div>

            {/* Filters */}
            <div className="space-y-3">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Çekim ara..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                        />
                    </div>
                    <button
                        onClick={() => setShowDateFilter(!showDateFilter)}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors',
                            showDateFilter ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                        )}
                    >
                        <CalendarRange className="w-4 h-4" /> Tarih Filtresi
                    </button>
                </div>

                {/* Date filter row */}
                {showDateFilter && (
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <label className="text-sm text-muted-foreground">Başlangıç:</label>
                        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                            className="px-3 py-1.5 text-sm rounded-lg bg-background border border-input focus:border-primary outline-none" />
                        <label className="text-sm text-muted-foreground">Bitiş:</label>
                        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                            className="px-3 py-1.5 text-sm rounded-lg bg-background border border-input focus:border-primary outline-none" />
                        {(dateFrom || dateTo) && (
                            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="p-1.5 hover:bg-muted rounded">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}

                <div className="flex gap-2 flex-wrap">
                    {statusFilters.map((f) => (
                        <button
                            key={f.value}
                            onClick={() => { setStatus(f.value); setPage(1); }}
                            className={cn(
                                'px-3 py-2 text-sm rounded-lg transition-colors',
                                status === f.value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted hover:bg-muted/80'
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            {isLoading ? (
                <SkeletonList rows={8} />
            ) : shoots.length === 0 ? (
                <div className="text-center py-12">
                    <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium">Çekim bulunamadı</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {shoots.map((shoot) => (
                        <ShootCard key={shoot.id} shoot={shoot} />
                    ))}
                </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="p-2 rounded-lg hover:bg-muted disabled:opacity-50"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="px-4 py-2 text-sm">
                        Sayfa {page} / {pagination.pages}
                    </span>
                    <button
                        onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                        disabled={page === pagination.pages}
                        className="p-2 rounded-lg hover:bg-muted disabled:opacity-50"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            )}

            <AddShootModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
        </div>
    );
}

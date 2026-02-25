import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { customersApi } from '../services/api';
import { formatDate, formatCurrency, getInitials, cn } from '../lib/utils';
import {
    Search,
    Filter,
    Phone,
    Mail,
    Calendar,
    Star,
    Loader2,
    ChevronLeft,
    ChevronRight,
    X
} from 'lucide-react';
import toast from 'react-hot-toast';

// Customer Card Component
function CustomerCard({ customer }) {
    return (
        <Link
            to={`/customers/${customer.id}`}
            className="bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:border-primary/50 transition-all group"
        >
            <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium shrink-0">
                    {getInitials(customer.fullName)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                            {customer.fullName}
                        </h3>
                        {customer.isVip && (
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground">{customer.customerCode}</p>
                </div>
            </div>

            {/* Contact Info */}
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                {customer.phone && (
                    <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <span>{customer.phone}</span>
                    </div>
                )}
                {customer.email && (
                    <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{customer.email}</span>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{customer._count?.shoots || 0} çekim</span>
                </div>
                <span className="text-muted-foreground">
                    {formatDate(customer.createdAt)}
                </span>
            </div>
        </Link>
    );
}

// Add Customer Modal
function AddCustomerModal({ isOpen, onClose }) {
    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        email: '',
        customerType: 'individual',
        source: 'walk_in',
        isVip: false,
        notes: ''
    });

    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: (data) => customersApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast.success('Müşteri oluşturuldu');
            onClose();
        },
        onError: (error) => {
            toast.error(error.response?.data?.error || 'Hata oluştu');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.fullName || !formData.phone) {
            toast.error('Ad ve telefon zorunludur');
            return;
        }
        createMutation.mutate(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Yeni Müşteri</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Ad Soyad *</label>
                        <input
                            type="text"
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                            placeholder="Ahmet Yılmaz"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5">Telefon *</label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                            placeholder="0532 123 45 67"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5">E-posta</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                            placeholder="email@ornek.com"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1.5">Müşteri Tipi</label>
                            <select
                                value={formData.customerType}
                                onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                            >
                                <option value="individual">Bireysel</option>
                                <option value="corporate">Kurumsal</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5">Kaynak</label>
                            <select
                                value={formData.source}
                                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                            >
                                <option value="walk_in">Yürüyen Müşteri</option>
                                <option value="referral">Referans</option>
                                <option value="instagram">Instagram</option>
                                <option value="google">Google</option>
                                <option value="website">Website</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isVip"
                            checked={formData.isVip}
                            onChange={(e) => setFormData({ ...formData, isVip: e.target.checked })}
                            className="w-4 h-4 rounded border-input"
                        />
                        <label htmlFor="isVip" className="text-sm">VIP Müşteri</label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5">Notlar</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none resize-none"
                            rows={3}
                            placeholder="Ek notlar..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
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

export default function Customers() {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({ customerType: '', source: '', isVip: '' });

    const limit = 12;

    const { data, isLoading } = useQuery({
        queryKey: ['customers', { page, limit, search }],
        queryFn: () => customersApi.list({ page, limit, search }).then(res => res.data)
    });

    const allCustomers = data?.data || [];
    const pagination = data?.pagination || { total: 0, pages: 1 };

    // Client-side filtering
    const customers = allCustomers.filter(c => {
        if (filters.customerType && c.customerType !== filters.customerType) return false;
        if (filters.source && c.source !== filters.source) return false;
        if (filters.isVip === 'true' && !c.isVip) return false;
        if (filters.isVip === 'false' && c.isVip) return false;
        return true;
    });

    const activeFilterCount = Object.values(filters).filter(Boolean).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Müşteriler</h1>
                    <p className="text-muted-foreground">
                        {pagination.total} müşteri kayıtlı
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-700">
                        <span>ℹ️ Müşteriler arşiv kayıtlarından otomatik oluşturulur</span>
                    </div>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        placeholder="Müşteri ara... (ad, telefon, email)"
                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
                    />
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors',
                        activeFilterCount > 0
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:bg-muted'
                    )}
                >
                    <Filter className="w-5 h-5" />
                    Filtrele
                    {activeFilterCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                            {activeFilterCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-end gap-4">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Müşteri Tipi</label>
                        <select value={filters.customerType}
                            onChange={e => setFilters({ ...filters, customerType: e.target.value })}
                            className="px-3 py-2 rounded-lg bg-background border border-input text-sm outline-none">
                            <option value="">Tümü</option>
                            <option value="individual">Bireysel</option>
                            <option value="corporate">Kurumsal</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Kaynak</label>
                        <select value={filters.source}
                            onChange={e => setFilters({ ...filters, source: e.target.value })}
                            className="px-3 py-2 rounded-lg bg-background border border-input text-sm outline-none">
                            <option value="">Tümü</option>
                            <option value="walk-in">Yürüyen Müşteri</option>
                            <option value="referral">Referans</option>
                            <option value="instagram">Instagram</option>
                            <option value="google">Google</option>
                            <option value="website">Website</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">VIP</label>
                        <select value={filters.isVip}
                            onChange={e => setFilters({ ...filters, isVip: e.target.value })}
                            className="px-3 py-2 rounded-lg bg-background border border-input text-sm outline-none">
                            <option value="">Tümü</option>
                            <option value="true">VIP</option>
                            <option value="false">Normal</option>
                        </select>
                    </div>
                    <button
                        onClick={() => setFilters({ customerType: '', source: '', isVip: '' })}
                        className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                        Temizle
                    </button>
                </div>
            )}

            {/* Customer Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : customers.length === 0 ? (
                <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                        <Search className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-medium">Müşteri bulunamadı</p>
                    <p className="text-muted-foreground">
                        {search ? 'Farklı arama kriterleri deneyin' : 'Yeni müşteri ekleyin'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {customers.map((customer) => (
                        <CustomerCard key={customer.id} customer={customer} />
                    ))}
                </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="px-4 py-2 text-sm">
                        Sayfa {page} / {pagination.pages}
                    </span>
                    <button
                        onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                        disabled={page === pagination.pages}
                        className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            )}

        </div>
    );
}

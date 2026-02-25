import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { archivesApi, optionsApi } from '../services/api';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
    Search, ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown,
    X, Loader2, LayoutList, LayoutGrid, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

// Workflow statuses (shared with Archives.jsx)
const WORKFLOW_STATUSES = {
    selection_pending: { label: 'Seçim Yapılacak', color: 'bg-yellow-500/15 text-yellow-600' },
    preparing: { label: 'Hazırlanıyor', color: 'bg-blue-500/15 text-blue-600' },
    printing: { label: 'Basılacak', color: 'bg-purple-500/15 text-purple-600' },
    ready: { label: 'Hazır', color: 'bg-green-500/15 text-green-600' },
    delivered: { label: 'Teslim Edildi', color: 'bg-gray-500/15 text-gray-500' }
};

function WorkflowBadge({ status }) {
    const s = WORKFLOW_STATUSES[status] || WORKFLOW_STATUSES.selection_pending;
    return <span className={`text-xs font-medium px-2 py-0.5 rounded ${s.color}`}>{s.label}</span>;
}

function PaymentBadge({ totalAmount, cashAmount, cardAmount, transferAmount }) {
    const total = totalAmount || 0;
    const paid = (cashAmount || 0) + (cardAmount || 0) + (transferAmount || 0);
    const remaining = total - paid;
    if (total === 0) return null;
    if (remaining <= 0) return <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-500/15 text-green-600">Ödendi</span>;
    if (paid === 0) return <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-500/15 text-red-600">Ödenmedi (₺{remaining})</span>;
    return <span className="text-xs font-medium px-2 py-0.5 rounded bg-orange-500/15 text-orange-600">Kapora (₺{remaining} kalan)</span>;
}

// Payment status calculator
function getPaymentStatus(arc) {
    const total = arc.totalAmount || 0;
    const paid = (arc.cashAmount || 0) + (arc.cardAmount || 0) + (arc.transferAmount || 0);
    if (total === 0) return 'none';
    if (total - paid <= 0) return 'paid';
    if (paid === 0) return 'unpaid';
    return 'partial';
}

// Status change dropdown
function StatusDropdown({ archive, onUpdate }) {
    const [open, setOpen] = useState(false);
    const currentStatus = archive.workflowStatus || 'selection_pending';

    return (
        <div className="relative">
            <button onClick={() => setOpen(!open)}>
                <WorkflowBadge status={currentStatus} />
            </button>
            {open && (
                <div className="absolute z-20 top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
                    {Object.entries(WORKFLOW_STATUSES).map(([key, val]) => (
                        <button
                            key={key}
                            onClick={() => { onUpdate(archive.id, key); setOpen(false); }}
                            className={cn(
                                'w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors',
                                currentStatus === key && 'bg-muted font-medium'
                            )}
                        >
                            {val.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// Sortable column header
function SortHeader({ label, field, sortField, sortDir, onSort }) {
    const active = sortField === field;
    return (
        <th
            className="text-left px-3 py-2 font-medium border-r border-border cursor-pointer select-none hover:bg-muted/30"
            onClick={() => onSort(field)}
        >
            <div className="flex items-center gap-1">
                {label}
                {active ? (
                    sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                ) : (
                    <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />
                )}
            </div>
        </th>
    );
}

// Per-page options
const PAGE_SIZES = [20, 50, 100];

export default function ArchiveSearch() {
    // Filters
    const [filters, setFilters] = useState({
        name: '', phone: '', archiveNo: '',
        dateFrom: '', dateTo: '',
        shootTypeId: '', workflowStatus: '', paymentStatus: '',
        photographerId: ''
    });
    const [appliedFilters, setAppliedFilters] = useState(filters);

    // Sort
    const [sortField, setSortField] = useState('createdAt');
    const [sortDir, setSortDir] = useState('desc');

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    // View mode
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'grouped'

    const queryClient = useQueryClient();

    // Options
    const { data: shootTypes } = useQuery({ queryKey: ['shootTypes'], queryFn: () => optionsApi.getShootTypes().then(r => r.data) });
    const { data: photographers } = useQuery({ queryKey: ['photographers'], queryFn: () => optionsApi.getPhotographers().then(r => r.data) });

    // Fetch all archives (we filter client-side for now)
    const { data: archivesData, isLoading } = useQuery({
        queryKey: ['archives', 'search'],
        queryFn: () => archivesApi.list({ limit: 1000 })
    });

    const allArchives = archivesData?.data || [];

    // Status update mutation
    const statusMutation = useMutation({
        mutationFn: ({ id, status }) => archivesApi.update(id, { workflowStatus: status }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['archives'] }); toast.success('Durum güncellendi'); },
        onError: () => toast.error('Durum güncellenemedi')
    });

    // Apply filters
    const filteredArchives = useMemo(() => {
        let result = [...allArchives];
        const f = appliedFilters;

        if (f.name) result = result.filter(a => a.fullName?.toLowerCase().includes(f.name.toLowerCase()));
        if (f.phone) result = result.filter(a => a.phone?.includes(f.phone));
        if (f.archiveNo) result = result.filter(a => a.archiveNumber?.toString().includes(f.archiveNo));
        if (f.shootTypeId) result = result.filter(a => a.shootTypeId?.toString() === f.shootTypeId);
        if (f.photographerId) result = result.filter(a => a.photographerId?.toString() === f.photographerId);
        if (f.workflowStatus) result = result.filter(a => (a.workflowStatus || 'selection_pending') === f.workflowStatus);
        if (f.paymentStatus) result = result.filter(a => getPaymentStatus(a) === f.paymentStatus);
        if (f.dateFrom) result = result.filter(a => a.createdAt >= f.dateFrom);
        if (f.dateTo) result = result.filter(a => a.createdAt <= f.dateTo + 'T23:59:59');

        return result;
    }, [allArchives, appliedFilters]);

    // Sort
    const sortedArchives = useMemo(() => {
        const sorted = [...filteredArchives];
        sorted.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];
            if (sortField === 'shootType') { aVal = a.shootType?.name || ''; bVal = b.shootType?.name || ''; }
            if (sortField === 'location') { aVal = a.location?.name || ''; bVal = b.location?.name || ''; }
            if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            if (typeof aVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
            return 0;
        });
        return sorted;
    }, [filteredArchives, sortField, sortDir]);

    // Paginate
    const totalPages = Math.ceil(sortedArchives.length / pageSize) || 1;
    const pagedArchives = sortedArchives.slice((page - 1) * pageSize, page * pageSize);

    // Grouped view
    const groupedArchives = useMemo(() => {
        const groups = {};
        Object.keys(WORKFLOW_STATUSES).forEach(key => { groups[key] = []; });
        filteredArchives.forEach(arc => {
            const status = arc.workflowStatus || 'selection_pending';
            if (groups[status]) groups[status].push(arc);
        });
        return groups;
    }, [filteredArchives]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
        setPage(1);
    };

    const handleSearch = () => { setAppliedFilters({ ...filters }); setPage(1); };
    const handleClear = () => {
        const empty = { name: '', phone: '', archiveNo: '', dateFrom: '', dateTo: '', shootTypeId: '', workflowStatus: '', paymentStatus: '', photographerId: '' };
        setFilters(empty);
        setAppliedFilters(empty);
        setPage(1);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/archives" className="p-2 hover:bg-muted rounded-lg">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Detaylı Arşiv Arama</h1>
                        <p className="text-sm text-muted-foreground">{filteredArchives.length} sonuç bulundu</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                    <button
                        onClick={() => setViewMode('list')}
                        className={cn('p-2 rounded-md', viewMode === 'list' ? 'bg-card shadow-sm' : 'hover:bg-card/50')}
                        title="Liste Görünümü"
                    >
                        <LayoutList className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('grouped')}
                        className={cn('p-2 rounded-md', viewMode === 'grouped' ? 'bg-card shadow-sm' : 'hover:bg-card/50')}
                        title="Durum Görünümü"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Filter Panel */}
            <div className="bg-card border border-border rounded-xl p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    <div>
                        <label className="block text-xs font-medium mb-1">İsim</label>
                        <input type="text" value={filters.name} onChange={e => setFilters({ ...filters, name: e.target.value })}
                            placeholder="Ad Soyad..." className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">Telefon</label>
                        <input type="text" value={filters.phone} onChange={e => setFilters({ ...filters, phone: e.target.value })}
                            placeholder="Tel..." className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">Arşiv No</label>
                        <input type="text" value={filters.archiveNo} onChange={e => setFilters({ ...filters, archiveNo: e.target.value })}
                            placeholder="#..." className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">Tarih Başlangıç</label>
                        <input type="date" value={filters.dateFrom} onChange={e => setFilters({ ...filters, dateFrom: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">Tarih Bitiş</label>
                        <input type="date" value={filters.dateTo} onChange={e => setFilters({ ...filters, dateTo: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">Çekim Türü</label>
                        <select value={filters.shootTypeId} onChange={e => setFilters({ ...filters, shootTypeId: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm">
                            <option value="">Tümü</option>
                            {shootTypes?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">Fotoğrafçı</label>
                        <select value={filters.photographerId} onChange={e => setFilters({ ...filters, photographerId: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm">
                            <option value="">Tümü</option>
                            {photographers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">İş Durumu</label>
                        <select value={filters.workflowStatus} onChange={e => setFilters({ ...filters, workflowStatus: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm">
                            <option value="">Tümü</option>
                            {Object.entries(WORKFLOW_STATUSES).map(([key, val]) => (
                                <option key={key} value={key}>{val.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">Ödeme</label>
                        <select value={filters.paymentStatus} onChange={e => setFilters({ ...filters, paymentStatus: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input outline-none text-sm">
                            <option value="">Tümü</option>
                            <option value="paid">Ödendi</option>
                            <option value="partial">Kapora Alındı</option>
                            <option value="unpaid">Ödenmedi</option>
                        </select>
                    </div>
                    <div className="flex items-end gap-2">
                        <button onClick={handleSearch} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm">
                            <Search className="w-4 h-4 inline mr-1" /> Ara
                        </button>
                        <button onClick={handleClear} className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-sm">
                            Temizle
                        </button>
                    </div>
                </div>
            </div>

            {/* Results */}
            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : viewMode === 'list' ? (
                /* List View */
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 sticky top-0 border-b border-border">
                                <tr>
                                    <SortHeader label="Arşiv" field="archiveNumber" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                                    <SortHeader label="Ad Soyad" field="fullName" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                                    <SortHeader label="Tarih" field="createdAt" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                                    <SortHeader label="Çekim Türü" field="shootType" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                                    <SortHeader label="Yer" field="location" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                                    <th className="text-left px-3 py-2 font-medium border-r border-border">Durum</th>
                                    <SortHeader label="Tutar" field="totalAmount" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {pagedArchives.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Sonuç bulunamadı</td></tr>
                                ) : (
                                    pagedArchives.map(arc => (
                                        <tr key={arc.id} className="hover:bg-muted/30">
                                            <td className="px-3 py-2 font-mono text-xs border-r border-border">{arc.archiveNumber || '-'}</td>
                                            <td className="px-3 py-2 font-medium border-r border-border">
                                                {arc.fullName}
                                                <p className="text-xs text-muted-foreground">{arc.phone}</p>
                                            </td>
                                            <td className="px-3 py-2 text-muted-foreground border-r border-border">{format(new Date(arc.createdAt), 'dd.MM.yyyy')}</td>
                                            <td className="px-3 py-2 border-r border-border">{arc.shootType?.name}</td>
                                            <td className="px-3 py-2 border-r border-border">{arc.location?.name}</td>
                                            <td className="px-3 py-2 border-r border-border">
                                                <div className="flex flex-col gap-1">
                                                    <StatusDropdown
                                                        archive={arc}
                                                        onUpdate={(id, status) => statusMutation.mutate({ id, status })}
                                                    />
                                                    <PaymentBadge
                                                        totalAmount={arc.totalAmount}
                                                        cashAmount={arc.cashAmount}
                                                        cardAmount={arc.cardAmount}
                                                        transferAmount={arc.transferAmount}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium">{formatCurrency(arc.totalAmount || 0)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Sayfa başına:</span>
                            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                                className="px-2 py-1 rounded bg-background border border-input text-sm outline-none">
                                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sortedArchives.length)} / {sortedArchives.length}
                            </span>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="p-1.5 rounded hover:bg-muted disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="p-1.5 rounded hover:bg-muted disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>
            ) : (
                /* Grouped (Status) View */
                <div className="space-y-6">
                    {Object.entries(WORKFLOW_STATUSES).map(([statusKey, statusInfo]) => {
                        const items = groupedArchives[statusKey] || [];
                        return (
                            <div key={statusKey} className="bg-card border border-border rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusInfo.color}`}>{statusInfo.label}</span>
                                        <span className="text-sm text-muted-foreground">({items.length})</span>
                                    </div>
                                </div>
                                {items.length === 0 ? (
                                    <div className="py-6 text-center text-sm text-muted-foreground">Bu durumda kayıt yok</div>
                                ) : (
                                    <div className="divide-y divide-border">
                                        {items.map(arc => (
                                            <div key={arc.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30">
                                                <div className="font-mono text-xs text-muted-foreground w-16">{arc.archiveNumber || '-'}</div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{arc.fullName}</p>
                                                    <p className="text-xs text-muted-foreground">{arc.shootType?.name} • {format(new Date(arc.createdAt), 'dd.MM.yyyy')}</p>
                                                </div>
                                                <PaymentBadge totalAmount={arc.totalAmount} cashAmount={arc.cashAmount} cardAmount={arc.cardAmount} transferAmount={arc.transferAmount} />
                                                <StatusDropdown
                                                    archive={arc}
                                                    onUpdate={(id, status) => statusMutation.mutate({ id, status })}
                                                />
                                                <div className="text-right w-24">
                                                    <p className="font-medium">{formatCurrency(arc.totalAmount || 0)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

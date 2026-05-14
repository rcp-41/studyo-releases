/**
 * Archives — Orchestrator
 * Alt-bileşenler: ArchiveDetailModal, ArchiveFilters, ArchiveList,
 *                 AppointmentSidebar, WhatsAppModal (components/archives/)
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { archivesApi, optionsApi, schoolsApi } from '../services/api';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import notify from '../lib/notify';
import WooCommerceModal from '../components/WooCommerceModal';

import ArchiveDetailModal from './archives/ArchiveDetailModal';
import ArchiveFilters from './archives/ArchiveFilters';
import ArchiveList from './archives/ArchiveList';
import AppointmentSidebar from '../components/archives/AppointmentSidebar';
import WhatsAppModal from '../components/archives/WhatsAppModal';
import { useArchiveData } from '../components/archives/useArchiveData';
import { useResizableSidebar } from '../components/archives/useResizableSidebar';

export default function Archives() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const location = useLocation();

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [selectedArchive, setSelectedArchive] = useState(null);
    const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
    const [whatsAppArchive, setWhatsAppArchive] = useState(null);
    const [wcModalOpen, setWcModalOpen] = useState(false);
    const [wcArchive, setWcArchive] = useState(null);
    const [workflowPopup, setWorkflowPopup] = useState(null);

    // Search + filter state
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filterShootType, setFilterShootType] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [filterSchool, setFilterSchool] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Hooks
    const { sidebarWidth, containerRef, handleMouseDown } = useResizableSidebar();
    const { archives, isLoading, hasMore, loadingMore, loadMore, basePath } = useArchiveData(
        search,
        { filterShootType, filterLocation, filterSchool, filterStatus }
    );

    // Filter dropdown data
    const { data: shootTypes } = useQuery({ queryKey: ['shootTypes'], queryFn: () => optionsApi.getShootTypes().then(r => r.data) });
    const { data: locations } = useQuery({ queryKey: ['locations'], queryFn: () => optionsApi.getLocations().then(r => r.data) });
    const { data: schools } = useQuery({ queryKey: ['schools'], queryFn: () => schoolsApi.list().then(r => r.data || []) });

    const hasActiveFilters = !!(filterShootType || filterLocation || filterSchool || filterStatus);
    const clearAllFilters = () => { setFilterShootType(''); setFilterLocation(''); setFilterSchool(''); setFilterStatus(''); };

    const handleFilterChange = (field, value) => {
        if (field === 'filterShootType') setFilterShootType(value);
        else if (field === 'filterLocation') setFilterLocation(value);
        else if (field === 'filterSchool') setFilterSchool(value);
        else if (field === 'filterStatus') setFilterStatus(value);
    };

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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['archives'] });
            notify.success(t('pages.archives.statusUpdated'));
            setWorkflowPopup(null);
        },
        onError: () => notify.error(t('pages.archives.statusUpdateFailed'))
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
                        <h1 className="text-2xl font-bold">{t('pages.archives.title')}</h1>
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
                            {hasActiveFilters
                                ? `${t('pages.archives.filters')} (${[filterShootType, filterLocation, filterSchool, filterStatus].filter(Boolean).length})`
                                : t('pages.archives.filters')}
                        </button>
                        <Link to="/archives/search"
                            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">
                            {t('pages.archives.detailedSearch')}
                        </Link>
                        <button onClick={() => { setSelectedArchive(null); setShowModal(true); }}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                            <Plus className="w-5 h-5" /> {t('pages.archives.newRecord')}
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
                        onChange={handleFilterChange}
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

            {/* Modals */}
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

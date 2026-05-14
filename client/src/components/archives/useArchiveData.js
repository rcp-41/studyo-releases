import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { archivesApi, settingsApi } from '../../services/api';
import { useTranslation } from 'react-i18next';
import notify from '../../lib/notify';

/**
 * Arşiv listesi verisi + sayfalama + base path + filtre mantığını kapsüller.
 */
export function useArchiveData(search, { filterShootType, filterLocation, filterSchool, filterStatus }) {
    const { t } = useTranslation();
    const [allArchives, setAllArchives] = useState([]);
    const [lastDocId, setLastDocId] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [licenseBasePath, setLicenseBasePath] = useState(null);

    const { data: archivesData, isLoading } = useQuery({
        queryKey: ['archives', search],
        queryFn: () => archivesApi.list({ search, limit: 50 })
    });

    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsApi.getAll().then(r => r.data)
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
            notify.error(t('pages.archives.loadMoreFailed'));
        }
        setLoadingMore(false);
    }, [lastDocId, loadingMore, search, t]);

    const settingsBasePath = settings?.general?.archive_base_path;
    useEffect(() => {
        if (!settingsBasePath && window.electron?.getLicenseConfig) {
            window.electron.getLicenseConfig().then(config => {
                if (config?.studios?.length > 0 && config.studios[0].path) setLicenseBasePath(config.studios[0].path);
                else if (config?.archiveBasePath) setLicenseBasePath(config.archiveBasePath);
            }).catch(() => { });
        }
    }, [settingsBasePath]);

    const basePath = settingsBasePath || licenseBasePath;

    const archives = allArchives.filter(arc => {
        if (filterShootType && (arc.shootTypeId?.toString() !== filterShootType && arc.shootType?.id?.toString() !== filterShootType)) return false;
        if (filterLocation && (arc.locationId?.toString() !== filterLocation && arc.location?.id?.toString() !== filterLocation)) return false;
        if (filterSchool && arc.schoolId !== filterSchool) return false;
        if (filterStatus && arc.workflowStatus !== filterStatus) return false;
        return true;
    });

    return { archives, isLoading, hasMore, loadingMore, loadMore, basePath };
}

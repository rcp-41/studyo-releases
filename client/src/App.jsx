import { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuthStore from './store/authStore';

// Critical routes — NOT lazy (always needed on first load)
import Login from './pages/Login';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import Archives from './pages/Archives';

// Lazy-loaded routes
const ArchiveSearch = lazy(() => import('./pages/ArchiveSearch'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Settings = lazy(() => import('./pages/Settings'));
const Users = lazy(() => import('./pages/Users'));
const WcClients = lazy(() => import('./pages/WcClients'));
const Customers = lazy(() => import('./pages/Customers'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const Shoots = lazy(() => import('./pages/Shoots'));
const ShootDetail = lazy(() => import('./pages/ShootDetail'));
const Finance = lazy(() => import('./pages/Finance'));
const Reports = lazy(() => import('./pages/Reports'));
const CashRegister = lazy(() => import('./pages/CashRegister'));
const PixonaiSettings = lazy(() => import('./pages/PixonaiSettings'));
const BotConversations = lazy(() => import('./pages/BotConversations'));

import AppLayout from './components/layout/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';
import BaseOSLoader from './components/BaseOSLoader';

function PageLoader() {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <BaseOSLoader size={36} />
        </div>
    );
}

// Role-based Dashboard Router
function DashboardRouter() {
    const user = useAuthStore((state) => state.user);
    if (user?.role === 'admin') return <Dashboard />;
    return <Archives />;
}

// Protected Route Wrapper
function ProtectedRoute() {
    const user = useAuthStore((state) => state.user);
    const loading = useAuthStore((state) => state.loading);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <BaseOSLoader size={48} />
            </div>
        );
    }

    if (!user) return <Navigate to="/login" replace />;
    return <AppLayout><Outlet /></AppLayout>;
}

// Admin Route Wrapper
function AdminRoute({ children }) {
    const user = useAuthStore((state) => state.user);
    if (user?.role !== 'admin') return <Navigate to="/archives" replace />;
    return children;
}

// License Check Wrapper
function LicenseCheck({ children }) {
    const [loading, setLoading] = useState(true);
    const [hasLicense, setHasLicense] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const checkLicense = async () => {
            try {
                let config = null;

                if (window.electron && window.electron.getLicenseConfig) {
                    config = await window.electron.getLicenseConfig();
                } else {
                    try {
                        const stored = localStorage.getItem('studyo_license');
                        config = stored ? JSON.parse(stored) : null;
                    } catch (parseErr) {
                        console.error('[License] Failed to parse stored config:', parseErr);
                        localStorage.removeItem('studyo_license');
                        config = null;
                    }
                }

                if (config && config.studioId) {
                    if (window.electron && config.hwid && config.organizationId) {
                        try {
                            const { httpsCallable } = await import('firebase/functions');
                            const { functions } = await import('./lib/firebase');
                            const checkHwidStatus = httpsCallable(functions, 'setup-checkHwidStatus');
                            const result = await checkHwidStatus({
                                organizationId: config.organizationId,
                                studioId: config.studioId,
                                hwid: config.hwid
                            });
                            const status = result.data?.status;
                            if (status === 'approved') {
                                setHasLicense(true);
                            } else {
                                console.warn('[LicenseCheck] Device not approved on server, status:', status);
                                if (window.electron?.clearLicenseConfig) {
                                    await window.electron.clearLicenseConfig();
                                } else {
                                    localStorage.removeItem('studyo_license');
                                }
                                setHasLicense(false);
                            }
                        } catch (verifyErr) {
                            console.error('[LicenseCheck] HWID verification failed:', verifyErr);
                            setHasLicense(true);
                        }
                    } else {
                        setHasLicense(true);
                    }
                } else {
                    setHasLicense(false);
                }
            } catch (error) {
                console.error('License check failed:', error);
                setHasLicense(false);
            } finally {
                setLoading(false);
            }
        };
        checkLicense();
    }, [location.pathname === '/setup']); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <BaseOSLoader size={48} />
            </div>
        );
    }

    if (!hasLicense && location.pathname !== '/setup') return <Navigate to="/setup" replace />;
    if (hasLicense && location.pathname === '/setup') return <Navigate to="/login" replace />;

    return children;
}

export default function App() {
    return (
        <ErrorBoundary>
            <OfflineBanner />
            <HashRouter>
                <LicenseCheck>
                    <Routes>
                        <Route path="/setup" element={<Setup />} />
                        <Route path="/login" element={<Login />} />

                        <Route element={<ProtectedRoute />}>
                            <Route index element={<Navigate to="/dashboard" replace />} />
                            <Route path="dashboard" element={<DashboardRouter />} />
                            <Route path="archives" element={<Archives />} />
                            <Route path="archives/search" element={<Suspense fallback={<PageLoader />}><ArchiveSearch /></Suspense>} />
                            <Route path="appointments" element={<Suspense fallback={<PageLoader />}><Appointments /></Suspense>} />
                            <Route path="customers" element={<Suspense fallback={<PageLoader />}><Customers /></Suspense>} />
                            <Route path="customers/detail" element={<Suspense fallback={<PageLoader />}><CustomerDetail /></Suspense>} />
                            <Route path="customers/:id" element={<Suspense fallback={<PageLoader />}><CustomerDetail /></Suspense>} />
                            <Route path="shoots" element={<Suspense fallback={<PageLoader />}><Shoots /></Suspense>} />
                            <Route path="shoots/:id" element={<Suspense fallback={<PageLoader />}><ShootDetail /></Suspense>} />
                            <Route path="finance" element={<AdminRoute><Suspense fallback={<PageLoader />}><Finance /></Suspense></AdminRoute>} />
                            <Route path="reports" element={<AdminRoute><Suspense fallback={<PageLoader />}><Reports /></Suspense></AdminRoute>} />
                            <Route path="cash-register" element={<Suspense fallback={<PageLoader />}><CashRegister /></Suspense>} />
                            <Route path="settings" element={<AdminRoute><Suspense fallback={<PageLoader />}><Settings /></Suspense></AdminRoute>} />
                            <Route path="users" element={<AdminRoute><Suspense fallback={<PageLoader />}><Users /></Suspense></AdminRoute>} />
                            <Route path="wc-clients" element={<AdminRoute><Suspense fallback={<PageLoader />}><WcClients /></Suspense></AdminRoute>} />
                            <Route path="pixonai-settings" element={<AdminRoute><Suspense fallback={<PageLoader />}><PixonaiSettings /></Suspense></AdminRoute>} />
                            <Route path="bot-conversations" element={<Suspense fallback={<PageLoader />}><BotConversations /></Suspense>} />
                        </Route>

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </LicenseCheck>
            </HashRouter>
        </ErrorBoundary>
    );
}

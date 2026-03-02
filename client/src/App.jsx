import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuthStore from './store/authStore';

import Login from './pages/Login';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import Archives from './pages/Archives';
import ArchiveSearch from './pages/ArchiveSearch';
import Appointments from './pages/Appointments';
import Settings from './pages/Settings';
import Users from './pages/Users';
import WcClients from './pages/WcClients';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Shoots from './pages/Shoots';
import ShootDetail from './pages/ShootDetail';
import Finance from './pages/Finance';
import Reports from './pages/Reports';
import CashRegister from './pages/CashRegister';
import PixonaiSettings from './pages/PixonaiSettings';
import BotConversations from './pages/BotConversations';
import AppLayout from './components/layout/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import SplashScreen from './components/SplashScreen';
import BaseOSLoader from './components/BaseOSLoader';

// Role-based Dashboard Router
// Admin → Dashboard, Personel → Archives
function DashboardRouter() {
    const user = useAuthStore((state) => state.user);
    if (user?.role === 'admin') {
        return <Dashboard />;
    }
    return <Archives />;
}

// Protected Route Wrapper
function ProtectedRoute() {
    const user = useAuthStore((state) => state.user);
    const loading = useAuthStore((state) => state.loading);

    // Wait for auth state to resolve before deciding
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

// Admin Route Wrapper - blocks non-admin users from accessing admin pages
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

                // Check Electron license
                if (window.electron && window.electron.getLicenseConfig) {
                    config = await window.electron.getLicenseConfig();
                } else {
                    // Fallback for web
                    const stored = localStorage.getItem('studyo_license');
                    if (stored) config = JSON.parse(stored);
                }

                if (config && config.studioId) {
                    // SECURITY: Verify HWID with server (Electron only)
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
                                // Device not approved — clear local license
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
                            // On network error, allow offline access with existing license
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
    }, [location.pathname]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <BaseOSLoader size={48} />
            </div>
        );
    }

    // If on setup page, allow access if no license
    if (!hasLicense && location.pathname !== '/setup') {
        return <Navigate to="/setup" replace />;
    }

    // If has license and trying to access setup, redirect to login
    if (hasLicense && location.pathname === '/setup') {
        return <Navigate to="/login" replace />;
    }

    return children;
}


export default function App() {
    const [showSplash, setShowSplash] = useState(true);

    if (showSplash) {
        return <SplashScreen onComplete={() => setShowSplash(false)} />;
    }

    return (
        <ErrorBoundary>
            <HashRouter>
                <LicenseCheck>
                    <Routes>
                        <Route path="/setup" element={<Setup />} />
                        <Route path="/login" element={<Login />} />

                        <Route element={<ProtectedRoute />}>
                            <Route index element={<Navigate to="/dashboard" replace />} />
                            <Route path="dashboard" element={<DashboardRouter />} />
                            <Route path="archives" element={<Archives />} />
                            <Route path="archives/search" element={<ArchiveSearch />} />
                            <Route path="appointments" element={<Appointments />} />
                            <Route path="customers" element={<Customers />} />
                            <Route path="customers/detail" element={<CustomerDetail />} />
                            <Route path="customers/:id" element={<CustomerDetail />} />
                            <Route path="shoots" element={<Shoots />} />
                            <Route path="shoots/:id" element={<ShootDetail />} />
                            <Route path="finance" element={<AdminRoute><Finance /></AdminRoute>} />
                            <Route path="reports" element={<AdminRoute><Reports /></AdminRoute>} />
                            <Route path="cash-register" element={<CashRegister />} />
                            <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
                            <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
                            <Route path="wc-clients" element={<AdminRoute><WcClients /></AdminRoute>} />
                            <Route path="pixonai-settings" element={<AdminRoute><PixonaiSettings /></AdminRoute>} />
                            <Route path="bot-conversations" element={<BotConversations />} />
                        </Route>

                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </LicenseCheck>
            </HashRouter>
        </ErrorBoundary>
    );
}

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
import AppLayout from './components/layout/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

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
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
                // Check Electron license
                if (window.electron && window.electron.getLicenseConfig) {
                    const config = await window.electron.getLicenseConfig();
                    if (config && config.studioId) {
                        setHasLicense(true);
                    }
                } else {
                    // Fallback for dev/web
                    const stored = localStorage.getItem('studyo_license');
                    if (stored) {
                        setHasLicense(true);
                    }
                }
            } catch (error) {
                console.error('License check failed:', error);
            } finally {
                setLoading(false);
            }
        };
        checkLicense();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // If on setup page, allow access if no license (or even if has license, maybe to reset?)
    // But typically if no license, force setup.
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
                            <Route path="cash-register" element={<AdminRoute><CashRegister /></AdminRoute>} />
                            <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
                            <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
                            <Route path="wc-clients" element={<WcClients />} />
                        </Route>

                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </LicenseCheck>
            </HashRouter>
        </ErrorBoundary>
    );
}

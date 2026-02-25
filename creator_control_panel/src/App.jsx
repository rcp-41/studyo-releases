import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Building2, LayoutDashboard, Database, Settings, LogOut, Loader2, Building, AlertTriangle } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';

import Dashboard from './pages/Dashboard';
import Organizations from './pages/Organizations';
import Studios from './pages/Studios';
import Migration from './pages/Migration';
import Login from './pages/Login';
import ErrorLogs from './pages/ErrorLogs';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

function ProtectedRoute({ children, user }) {
    if (!user) return <Navigate to="/login" replace />;
    return children;
}

function Sidebar({ onLogout }) {
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">🏢</div>
                    <div className="sidebar-logo-text">
                        <h1>Studyo</h1>
                        <span>Creator Panel</span>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <LayoutDashboard />
                    Dashboard
                </NavLink>
                <NavLink to="/organizations" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Building />
                    Organizasyonlar
                </NavLink>
                <NavLink to="/studios" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Building2 />
                    Stüdyolar
                </NavLink>
                <NavLink to="/migration" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Database />
                    Migration Bot
                </NavLink>
                <NavLink to="/error-logs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <AlertTriangle />
                    Hata Logları
                </NavLink>
                <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Settings />
                    Ayarlar
                </NavLink>
            </nav>

            <div style={{ padding: '16px 12px', borderTop: '1px solid var(--border-color)' }}>
                <button
                    className="nav-link"
                    onClick={onLogout}
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    <LogOut />
                    Çıkış Yap
                </button>
            </div>
        </aside>
    );
}

const queryClient = new QueryClient();

export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // GÜVENLİK: Creator rol kontrolü
                const tokenResult = await firebaseUser.getIdTokenResult();
                if (tokenResult.claims.role === 'creator') {
                    setUser(firebaseUser);
                } else {
                    // Creator olmayan kullanıcıları çıkış yap
                    await signOut(auth);
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setUser(null);
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0f172a',
                color: '#94a3b8'
            }}>
                <Loader2 style={{ width: '32px', height: '32px', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                {user ? (
                    <div className="app-container">
                        <Sidebar onLogout={handleLogout} />
                        <main className="main-content">
                            <Routes>
                                <Route path="/" element={<ProtectedRoute user={user}><Dashboard /></ProtectedRoute>} />
                                <Route path="/organizations" element={<ProtectedRoute user={user}><Organizations /></ProtectedRoute>} />
                                <Route path="/studios" element={<ProtectedRoute user={user}><Studios /></ProtectedRoute>} />
                                <Route path="/migration" element={<ProtectedRoute user={user}><Migration /></ProtectedRoute>} />
                                <Route path="/error-logs" element={<ProtectedRoute user={user}><ErrorLogs /></ProtectedRoute>} />
                                <Route path="/settings" element={<ProtectedRoute user={user}><div><h1>Ayarlar</h1></div></ProtectedRoute>} />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </main>
                    </div>
                ) : (
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                )}
                <Toaster position="bottom-right" />
            </BrowserRouter>
        </QueryClientProvider>
    );
}

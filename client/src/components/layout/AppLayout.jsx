import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { cn } from '../../lib/utils';
import {
    LayoutDashboard, Archive, Calendar, Camera, UsersRound, Wallet,
    Globe, Settings, Users, LogOut, Menu, X, Moon, Sun, ChevronDown, DollarSign, BarChart3, RefreshCw
} from 'lucide-react';
import Breadcrumb from '../Breadcrumb';
import NotificationCenter from '../NotificationCenter';
import AutoUpdater from '../AutoUpdater';

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, adminOnly: true },
    { name: 'Arşiv', href: '/archives', icon: Archive },
    { name: 'Randevular', href: '/appointments', icon: Calendar },
    { name: 'Müşteriler', href: '/customers', icon: UsersRound },
    { name: 'Finans', href: '/finance', icon: DollarSign, adminOnly: true },
    { name: 'Kasa', href: '/cash-register', icon: Wallet },
    { name: 'Raporlar', href: '/reports', icon: BarChart3, adminOnly: true },
    { name: 'Online Satış', href: '/wc-clients', icon: Globe, adminOnly: true },
    { name: 'Ayarlar', href: '/settings', icon: Settings, adminOnly: true },
    { name: 'Pixonai Ayarları', href: '/pixonai-settings', icon: Camera, adminOnly: true },
    { name: 'Kullanıcılar', href: '/users', icon: Users, adminOnly: true }
];

export default function AppLayout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('studyo-theme');
        const isDark = saved ? saved === 'dark' : true;
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        return isDark;
    });
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const { user, logout } = useAuthStore();
    const location = useLocation();
    const navigate = useNavigate();

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    // Global keyboard shortcuts
    const handleKeyDown = useCallback((e) => {
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);

        // Ctrl+N → New record (go to archives with create intent)
        if (e.ctrlKey && e.key === 'n' && !e.shiftKey) {
            e.preventDefault();
            navigate('/archives?action=new');
            return;
        }

        // Ctrl+Shift+D → Archive search
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            navigate('/archives/search');
            return;
        }

        // ESC → Close modals (dispatch custom event)
        if (e.key === 'Escape' && !isInput) {
            document.dispatchEvent(new CustomEvent('global-escape'));
        }
    }, [navigate]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const toggleDarkMode = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        document.documentElement.classList.toggle('dark', newMode);
        localStorage.setItem('studyo-theme', newMode ? 'dark' : 'light');
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const filteredNav = navigation.filter(item => !item.adminOnly || user?.role === 'admin');

    return (
        <div className="flex h-screen bg-background text-foreground">
            {/* Mobile overlay */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={cn(
                'fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border transition-all duration-300',
                // Desktop
                'hidden lg:flex',
                sidebarOpen ? 'lg:w-56' : 'lg:w-16'
            )}>
                {/* Logo */}
                <div className="flex items-center justify-between h-14 px-4 border-b border-border">
                    {sidebarOpen && (
                        <div className="flex items-baseline gap-1.5">
                            <span className="font-bold text-lg text-primary">STUDYO</span>
                            {window.versions?.app && <span className="text-[10px] text-muted-foreground">v{window.versions.app}</span>}
                            {!window.versions?.app && <span className="text-[10px] text-muted-foreground">v{__APP_VERSION__}</span>}
                        </div>
                    )}
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-muted rounded-lg">
                        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                    {filteredNav.map((item) => {
                        const isActive = location.pathname === item.href || (item.href === '/dashboard' && location.pathname === '/');
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={cn(
                                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                                    isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                                )}
                            >
                                <item.icon className="w-5 h-5 shrink-0" />
                                {sidebarOpen && <span>{item.name}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* Photo Selector Launch Button */}
                <div className="px-2 pb-2">
                    <button
                        onClick={() => {
                            if (window.electron?.photoSelector?.open) {
                                window.electron.photoSelector.open({});
                            }
                        }}
                        title="Fotoğraf Seçim"
                        className={cn(
                            'w-full rounded-xl transition-all duration-200 group relative overflow-hidden',
                            'bg-gradient-to-b from-amber-400 to-amber-600',
                            'shadow-[0_4px_0_0_#b45309,0_6px_12px_rgba(245,158,11,0.3)]',
                            'hover:shadow-[0_3px_0_0_#b45309,0_4px_8px_rgba(245,158,11,0.4)]',
                            'hover:translate-y-[1px]',
                            'active:shadow-[0_1px_0_0_#b45309,0_2px_4px_rgba(245,158,11,0.2)]',
                            'active:translate-y-[3px]',
                            sidebarOpen ? 'px-3 py-2.5' : 'p-2.5 flex justify-center'
                        )}
                    >
                        <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20 rounded-xl" />
                        <div className={cn('relative flex items-center', sidebarOpen ? 'gap-3' : 'justify-center')}>
                            <Camera className="w-5 h-5 text-amber-950 shrink-0 group-hover:scale-110 transition-transform" />
                            {sidebarOpen && (
                                <span className="text-sm font-bold text-amber-950">Fotoğraf Seçim</span>
                            )}
                        </div>
                    </button>
                </div>

                {/* User */}
                <div className="p-2 border-t border-border">
                    {sidebarOpen ? (
                        <div className="relative">
                            <button
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted"
                            >
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium text-sm">
                                    {user?.fullName?.charAt(0) || 'U'}
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-medium truncate">{user?.fullName}</p>
                                    <p className="text-xs text-muted-foreground">{user?.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}</p>
                                </div>
                                <ChevronDown className="w-4 h-4" />
                            </button>

                            {userMenuOpen && (
                                <div className="absolute bottom-full left-0 right-0 mb-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                                    <button onClick={toggleDarkMode} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-sm">
                                        {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                                        {darkMode ? 'Açık Mod' : 'Koyu Mod'}
                                    </button>
                                    {window.electron?.update?.check && (
                                        <button onClick={() => { window.electron.update.check(); setUserMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-sm">
                                            <RefreshCw className="w-4 h-4" />
                                            Güncellemeleri Denetle
                                        </button>
                                    )}
                                    <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-sm text-destructive">
                                        <LogOut className="w-4 h-4" />
                                        Çıkış Yap
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button onClick={handleLogout} className="w-full flex justify-center p-2 hover:bg-muted rounded-lg text-destructive">
                            <LogOut className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </aside>

            {/* Mobile sidebar */}
            <aside className={cn(
                'fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-card border-r border-border transition-transform duration-300 lg:hidden',
                mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            )}>
                <div className="flex items-center justify-between h-14 px-4 border-b border-border">
                    <div className="flex items-baseline gap-1.5">
                        <span className="font-bold text-lg text-primary">STUDYO</span>
                        {window.versions?.app && <span className="text-[10px] text-muted-foreground">v{window.versions.app}</span>}
                        {!window.versions?.app && <span className="text-[10px] text-muted-foreground">v{__APP_VERSION__}</span>}
                    </div>
                    <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-muted rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                    {filteredNav.map((item) => {
                        const isActive = location.pathname === item.href || (item.href === '/dashboard' && location.pathname === '/');
                        return (
                            <Link key={item.href} to={item.href}
                                className={cn('flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                                    isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                                <item.icon className="w-5 h-5 shrink-0" />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Photo Selector Launch Button (Mobile) */}
                <div className="px-3 pb-2">
                    <button
                        onClick={() => {
                            if (window.electron?.photoSelector?.open) {
                                window.electron.photoSelector.open({});
                            }
                            setMobileMenuOpen(false);
                        }}
                        className="w-full rounded-xl px-3 py-2.5 relative overflow-hidden
                            bg-gradient-to-b from-amber-400 to-amber-600
                            shadow-[0_4px_0_0_#b45309,0_6px_12px_rgba(245,158,11,0.3)]
                            hover:shadow-[0_3px_0_0_#b45309,0_4px_8px_rgba(245,158,11,0.4)]
                            hover:translate-y-[1px]
                            active:shadow-[0_1px_0_0_#b45309,0_2px_4px_rgba(245,158,11,0.2)]
                            active:translate-y-[3px]
                            transition-all duration-200 group"
                    >
                        <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20 rounded-xl" />
                        <div className="relative flex items-center gap-3">
                            <Camera className="w-5 h-5 text-amber-950 shrink-0 group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-bold text-amber-950">Fotoğraf Seçim</span>
                        </div>
                    </button>
                </div>

                <div className="p-4 border-t border-border space-y-2">
                    <button onClick={toggleDarkMode} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-lg text-sm">
                        {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        {darkMode ? 'Açık Mod' : 'Koyu Mod'}
                    </button>
                    {window.electron?.update?.check && (
                        <button onClick={() => { window.electron.update.check(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-lg text-sm">
                            <RefreshCw className="w-4 h-4" /> Güncellemeleri Denetle
                        </button>
                    )}
                    <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-lg text-sm text-destructive">
                        <LogOut className="w-4 h-4" /> Çıkış Yap
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={cn('flex-1 flex flex-col overflow-hidden transition-all duration-300',
                'lg:ml-16', sidebarOpen && 'lg:ml-56')}>

                {/* Top Header Bar */}
                <header className="h-14 flex items-center justify-between px-4 sm:px-6 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-muted rounded-lg lg:hidden">
                            <Menu className="w-5 h-5" />
                        </button>
                        <span className="font-bold text-primary lg:hidden">STUDYO</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <NotificationCenter />
                    </div>
                </header>

                {/* Page content */}
                <div className="flex-1 overflow-auto p-4 sm:p-6">
                    <Breadcrumb />
                    {children}
                </div>
            </main>

            <AutoUpdater />
        </div>
    );
}

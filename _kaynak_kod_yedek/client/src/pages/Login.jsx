import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Camera, Eye, EyeOff, Loader2, User, UserCog, RotateCcw, ShieldAlert, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Studio Mode State
    const [studioConfig, setStudioConfig] = useState(null);
    const [loginType, setLoginType] = useState('admin'); // 'admin' or 'user'

    // Reset Modal State
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetPassword, setResetPassword] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [showResetPassword, setShowResetPassword] = useState(false);

    const { login, loading } = useAuthStore();
    const user = useAuthStore((state) => state.user);
    const navigate = useNavigate();

    // Auto-redirect when user becomes authenticated
    useEffect(() => {
        if (user) {
            navigate('/', { replace: true });
        }
    }, [user, navigate]);

    // Check for Studio License
    useEffect(() => {
        const checkLicense = async () => {
            try {
                let config = null;
                if (window.electron && window.electron.getLicenseConfig) {
                    config = await window.electron.getLicenseConfig();
                } else {
                    const stored = localStorage.getItem('studyo_license');
                    if (stored) config = JSON.parse(stored);
                }

                if (config && config.studioId) {
                    setStudioConfig(config);
                }
            } catch (error) {
                console.error('Failed to load license:', error);
            }
        };
        checkLicense();
    }, []);

    // Build email silently from studioConfig + loginType
    const buildEmail = () => {
        if (!studioConfig?.studioId) return '';
        const domain = `${studioConfig.studioId}.studyo.app`;
        return loginType === 'admin' ? `admin@${domain}` : `user@${domain}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!password) {
            toast.error('Lütfen şifrenizi girin');
            return;
        }

        if (!studioConfig?.studioId) {
            toast.error('Stüdyo yapılandırması bulunamadı. Lütfen önce seri numarası ile kurulum yapın.');
            navigate('/setup');
            return;
        }

        const email = buildEmail();

        try {
            const result = await login(email, password);

            if (result.success) {
                toast.success('Giriş başarılı!');
                navigate('/');
            }
        } catch (error) {
            const message = error.message || 'Giriş başarısız';
            toast.error(message);
        }
    };

    const handleResetStudio = async () => {
        if (!resetPassword) {
            toast.error('Lütfen Super Admin şifresini girin');
            return;
        }

        setResetLoading(true);

        try {
            // SECURITY: Use environment variable for admin email
            const superAdminEmail = import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'recepkizilkan@gmail.com';
            await signInWithEmailAndPassword(auth, superAdminEmail, resetPassword);

            // Credentials verified — clear the license
            if (window.electron && window.electron.clearLicenseConfig) {
                const result = await window.electron.clearLicenseConfig();
                if (!result.success) {
                    throw new Error(result.error || 'Silme başarısız');
                }
            } else {
                // Fallback for web/dev mode
                localStorage.removeItem('studyo_license');
            }

            // Sign out the super admin
            await auth.signOut();

            toast.success('Stüdyo sıfırlandı! Yeni kuruluma yönlendiriliyorsunuz...');
            setShowResetModal(false);
            setResetPassword('');

            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (error) {
            console.error('Reset error:', error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                toast.error('Super Admin şifresi yanlış');
            } else if (error.code === 'auth/user-not-found') {
                toast.error('Super Admin hesabı bulunamadı');
            } else if (error.code === 'auth/too-many-requests') {
                toast.error('Çok fazla deneme. Lütfen biraz bekleyin');
            } else {
                toast.error(error.message || 'Sıfırlama başarısız');
            }
        } finally {
            setResetLoading(false);
        }
    };

    // If no studio config, redirect to setup
    if (!studioConfig) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4">
            <div className="w-full max-w-md">
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
                        <Camera className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold">
                        {studioConfig.studioName || 'Studyo Yönetim'}
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Stüdyo Yönetim Sistemi
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-card border border-border rounded-2xl shadow-xl p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Admin/Staff Toggle */}
                        <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setLoginType('admin')}
                                className={`flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${loginType === 'admin'
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <UserCog className="w-4 h-4" />
                                Yönetici
                            </button>
                            <button
                                type="button"
                                onClick={() => setLoginType('user')}
                                className={`flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${loginType === 'user'
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <User className="w-4 h-4" />
                                Personel
                            </button>
                        </div>

                        {/* Password - Only visible field */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Şifre
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 pr-12 rounded-lg bg-background border border-input focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    autoFocus
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 focus:ring-4 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Giriş yapılıyor...
                                </>
                            ) : (
                                'Giriş Yap'
                            )}
                        </button>
                    </form>

                    {/* Reset Studio Button */}
                    <div className="mt-6 pt-4 border-t border-border">
                        <button
                            type="button"
                            onClick={() => setShowResetModal(true)}
                            className="w-full py-2.5 px-4 text-sm font-medium text-muted-foreground hover:text-destructive border border-border hover:border-destructive/50 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Stüdyo Sıfırla
                        </button>
                        <p className="text-xs text-muted-foreground text-center mt-2">
                            Farklı bir stüdyoya geçmek için Super Admin şifresi gereklidir.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-muted-foreground mt-6">
                    © {new Date().getFullYear()} Studyo Yönetim Sistemi
                </p>
            </div>

            {/* Reset Modal */}
            {showResetModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in-95">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-destructive">
                                <ShieldAlert className="w-5 h-5" />
                                <h3 className="text-lg font-semibold">Stüdyo Sıfırla</h3>
                            </div>
                            <button
                                onClick={() => {
                                    setShowResetModal(false);
                                    setResetPassword('');
                                }}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Warning */}
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4">
                            <p className="text-sm text-destructive">
                                Bu işlem mevcut stüdyo bağlantısını kaldıracak.
                                Yeni bir stüdyo ID ile kurulum yapmanız gerekecek.
                            </p>
                        </div>

                        {/* Current Studio Info */}
                        <div className="bg-muted/50 rounded-lg p-3 mb-4">
                            <p className="text-xs text-muted-foreground">Mevcut Stüdyo</p>
                            <p className="text-sm font-medium">{studioConfig?.studioName}</p>
                        </div>

                        {/* Super Admin Password */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-2">
                                Super Admin Şifresi
                            </label>
                            <p className="text-xs text-muted-foreground mb-2">
                                Super Admin hesabının şifresi
                            </p>
                            <div className="relative">
                                <input
                                    type={showResetPassword ? 'text' : 'password'}
                                    value={resetPassword}
                                    onChange={(e) => setResetPassword(e.target.value)}
                                    className="w-full px-4 py-3 pr-12 rounded-lg bg-background border border-input focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    placeholder="••••••••"
                                    disabled={resetLoading}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleResetStudio();
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowResetPassword(!showResetPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowResetModal(false);
                                    setResetPassword('');
                                }}
                                disabled={resetLoading}
                                className="flex-1 py-2.5 px-4 border border-border rounded-lg text-sm font-medium hover:bg-muted/50 transition-all disabled:opacity-50"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleResetStudio}
                                disabled={resetLoading || !resetPassword}
                                className="flex-1 py-2.5 px-4 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {resetLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Doğrulanıyor...
                                    </>
                                ) : (
                                    <>
                                        <RotateCcw className="w-4 h-4" />
                                        Sıfırla
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

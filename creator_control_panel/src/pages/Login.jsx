import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth } from '../lib/firebase';
import { LogIn, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [totpCode, setTotpCode] = useState('');
    const [show2FA, setShow2FA] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const tokenResult = await userCredential.user.getIdTokenResult();

            // GÜVENLİK: Sadece creator rolü olan kullanıcılar giriş yapabilir
            if (tokenResult.claims.role !== 'creator') {
                await auth.signOut();
                setError('Bu panele erişim yetkiniz bulunmamaktadır. Sadece Creator rolüne sahip kullanıcılar giriş yapabilir.');
                setLoading(false);
                return;
            }

            // Check if 2FA is enabled for this user
            if (tokenResult.claims.totp_enabled) {
                if (!totpCode) {
                    setShow2FA(true);
                    setLoading(false);
                    return;
                }

                // Verify TOTP code via Cloud Function
                try {
                    const { functions } = await import('../lib/firebase');
                    const verifyTotp = httpsCallable(functions, 'setup-verifyTotp');
                    const result = await verifyTotp({ code: totpCode });

                    if (!result.data?.success) {
                        setError('Geçersiz 2FA kodu. Tekrar deneyin.');
                        setLoading(false);
                        return;
                    }
                } catch (totpErr) {
                    setError('2FA doğrulama hatası. Tekrar deneyin.');
                    setLoading(false);
                    return;
                }
            }
        } catch (err) {
            console.error('Login error:', err);
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('Email veya şifre hatalı.');
            } else if (err.code === 'auth/too-many-requests') {
                setError('Çok fazla başarısız giriş denemesi. Lütfen daha sonra tekrar deneyin.');
            } else {
                setError('Giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
        }}>
            <div style={{
                background: 'rgba(30, 41, 59, 0.8)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(100, 116, 139, 0.2)',
                borderRadius: '16px',
                padding: '48px',
                width: '100%',
                maxWidth: '420px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        fontSize: '24px'
                    }}>
                        🏢
                    </div>
                    <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: '700', margin: '0 0 4px' }}>
                        Studyo Creator Panel
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
                        Yönetim paneline giriş yapın
                    </p>
                </div>

                <form onSubmit={handleLogin}>
                    {error && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '20px',
                            color: '#fca5a5',
                            fontSize: '13px',
                            lineHeight: '1.4'
                        }}>
                            <AlertCircle style={{ width: '16px', height: '16px', marginTop: '1px', flexShrink: 0 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="creator@studyo.app"
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                background: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(100, 116, 139, 0.3)',
                                borderRadius: '8px',
                                color: '#f1f5f9',
                                fontSize: '14px',
                                outline: 'none',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.2s'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: show2FA ? '16px' : '24px' }}>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                            Şifre
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                background: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(100, 116, 139, 0.3)',
                                borderRadius: '8px',
                                color: '#f1f5f9',
                                fontSize: '14px',
                                outline: 'none',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.2s'
                            }}
                        />
                    </div>

                    {show2FA && (
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                                <ShieldCheck style={{ width: '14px', height: '14px', color: '#6366f1' }} />
                                2FA Doğrulama Kodu
                            </label>
                            <input
                                type="text"
                                value={totpCode}
                                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                required
                                placeholder="6 haneli kod"
                                maxLength={6}
                                autoFocus
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    border: '1px solid rgba(99, 102, 241, 0.4)',
                                    borderRadius: '8px',
                                    color: '#f1f5f9',
                                    fontSize: '18px',
                                    fontFamily: 'monospace',
                                    letterSpacing: '6px',
                                    textAlign: 'center',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    transition: 'border-color 0.2s'
                                }}
                            />
                            <p style={{ color: '#64748b', fontSize: '11px', marginTop: '6px', textAlign: 'center' }}>
                                Authenticator uygulamanızdaki kodu girin
                            </p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: loading ? 'rgba(99, 102, 241, 0.5)' : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'opacity 0.2s'
                        }}
                    >
                        {loading ? (
                            <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                        ) : (
                            <LogIn style={{ width: '18px', height: '18px' }} />
                        )}
                        {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                    </button>
                </form>
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                input:focus {
                    border-color: #6366f1 !important;
                }
            `}</style>
        </div>
    );
}

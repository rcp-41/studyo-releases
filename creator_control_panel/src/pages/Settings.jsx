import { useState, useEffect } from 'react';
import { User, Lock, Shield, Bell, Info, Copy, CheckCircle, Loader2, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { auth } from '../lib/firebase';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { creatorApi } from '../services/creatorApi';
import toast from 'react-hot-toast';

const PANEL_VERSION = import.meta.env.VITE_PANEL_VERSION || '1.0.41';
const BUILD_DATE = import.meta.env.VITE_BUILD_DATE || new Date().toLocaleDateString('tr-TR');

function SectionCard({ title, icon: Icon, children }) {
    return (
        <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                {Icon && <Icon size={20} style={{ color: 'var(--primary)' }} />}
                <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{title}</h2>
            </div>
            {children}
        </div>
    );
}

// ---- Profile Section ----
function ProfileSection({ user }) {
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [saving, setSaving] = useState(false);

    async function handlePasswordChange(e) {
        e.preventDefault();
        if (newPw !== confirmPw) { toast.error('Yeni şifreler eşleşmiyor'); return; }
        if (newPw.length < 8) { toast.error('Şifre en az 8 karakter olmalı'); return; }
        setSaving(true);
        try {
            const credential = EmailAuthProvider.credential(user.email, currentPw);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPw);
            toast.success('Şifre başarıyla güncellendi');
            setCurrentPw(''); setNewPw(''); setConfirmPw('');
        } catch (err) {
            if (err.code === 'auth/wrong-password') {
                toast.error('Mevcut şifre hatalı');
            } else {
                toast.error('Şifre değiştirilemedi: ' + err.message);
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <SectionCard title="Profil" icon={User}>
            <div className="form-group">
                <label className="form-label">E-posta</label>
                <input className="form-input" value={user?.email || ''} disabled />
            </div>
            <div className="form-group">
                <label className="form-label">Kullanıcı UID</label>
                <input className="form-input" value={user?.uid || ''} disabled style={{ fontFamily: 'monospace', fontSize: '12px' }} />
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Sifre Degistir</h3>
                <form onSubmit={handlePasswordChange}>
                    <div className="form-group">
                        <label className="form-label">Mevcut Sifre</label>
                        <div style={{ position: 'relative' }}>
                            <input type={showPw ? 'text' : 'password'} className="form-input"
                                value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                                required style={{ paddingRight: '40px' }} />
                            <button type="button" onClick={() => setShowPw(p => !p)}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Yeni Sifre</label>
                        <input type="password" className="form-input" value={newPw}
                            onChange={e => setNewPw(e.target.value)} required minLength={8} placeholder="Min. 8 karakter" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Yeni Sifre (Tekrar)</label>
                        <input type="password" className="form-input" value={confirmPw}
                            onChange={e => setConfirmPw(e.target.value)} required minLength={8} />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Kaydediliyor...</> : <><Lock size={16} /> Sifreyi Guncelle</>}
                    </button>
                </form>
            </div>
        </SectionCard>
    );
}

// ---- 2FA Section ----
function TwoFASection({ user }) {
    const [totpEnabled, setTotpEnabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState('idle'); // idle | setup | verify | disable
    const [secret, setSecret] = useState('');
    const [otpauthUrl, setOtpauthUrl] = useState('');
    const [code, setCode] = useState('');
    const [disableCode, setDisableCode] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        // Check current 2FA status from token
        user?.getIdTokenResult(true).then(result => {
            setTotpEnabled(!!result.claims.totp_enabled);
        });
    }, [user]);

    async function handleEnable() {
        setLoading(true);
        try {
            const result = await creatorApi.enable2FA();
            if (result?.success) {
                setSecret(result.secret);
                setOtpauthUrl(result.otpauthUrl);
                setStep('setup');
            }
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleVerify(e) {
        e.preventDefault();
        if (code.length !== 6) { toast.error('6 haneli kod gerekli'); return; }
        setLoading(true);
        try {
            const result = await creatorApi.verifyTotp(code);
            if (result?.success) {
                setTotpEnabled(true);
                setStep('idle');
                setCode('');
                toast.success('2FA etkinlestirildi!');
            } else {
                toast.error('Gecersiz kod, tekrar deneyin');
            }
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleDisable(e) {
        e.preventDefault();
        if (disableCode.length !== 6) { toast.error('6 haneli kod gerekli'); return; }
        setLoading(true);
        try {
            const result = await creatorApi.disableTotp(disableCode);
            if (result?.success) {
                setTotpEnabled(false);
                setStep('idle');
                setDisableCode('');
                toast.success('2FA devre disi birakildi');
            } else {
                toast.error('Gecersiz kod');
            }
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    }

    function copySecret() {
        navigator.clipboard.writeText(secret);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <SectionCard title="Iki Faktorlu Kimlik Dogrulama (2FA)" icon={Shield}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{
                    padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                    background: totpEnabled ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: totpEnabled ? '#22c55e' : '#ef4444'
                }}>
                    {totpEnabled ? 'Aktif' : 'Pasif'}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {totpEnabled ? '2FA hesabiniz koruyor.' : '2FA devre disi. Etkinlestirmenizi oneririz.'}
                </span>
            </div>

            {step === 'idle' && !totpEnabled && (
                <button className="btn btn-primary" onClick={handleEnable} disabled={loading}>
                    {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Shield size={16} />}
                    2FA Etkinlestir
                </button>
            )}

            {step === 'idle' && totpEnabled && (
                <button className="btn btn-secondary" onClick={() => setStep('disable')} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
                    2FA Kapat
                </button>
            )}

            {step === 'setup' && (
                <div>
                    <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '13px' }}>
                        <p style={{ marginBottom: '8px' }}>1. Bir kimlik dogrulama uygulamasi akin (Google Authenticator, Authy)</p>
                        <p style={{ marginBottom: '8px' }}>2. QR kodu tarat ya da gizli anahtari elle girin</p>
                        <p>3. Uygulamadan gelen 6 haneli kodu girin</p>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label className="form-label">Gizli Anahtar (manuel giris icin)</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input className="form-input" value={secret} readOnly style={{ fontFamily: 'monospace', letterSpacing: '2px' }} />
                            <button className="btn btn-secondary btn-sm" onClick={copySecret}>
                                {copied ? <CheckCircle size={14} color="#22c55e" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label className="form-label">QR Kod URL</label>
                        <a href={otpauthUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Baglantiyi ac <ExternalLink size={12} />
                        </a>
                    </div>

                    <form onSubmit={handleVerify}>
                        <div className="form-group">
                            <label className="form-label">Dogrulama Kodu</label>
                            <input className="form-input" placeholder="000000" maxLength={6}
                                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                                style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '18px' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button type="submit" className="btn btn-primary" disabled={loading || code.length !== 6}>
                                {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={16} />}
                                Dogrula & Etkinlestir
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => { setStep('idle'); setCode(''); }}>
                                Iptal
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {step === 'disable' && (
                <form onSubmit={handleDisable}>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                        2FA'yi devre disi birakmak icin kimlik dogrulama uygulamanizdan kodu girin:
                    </p>
                    <div className="form-group">
                        <label className="form-label">TOTP Kodu</label>
                        <input className="form-input" placeholder="000000" maxLength={6}
                            value={disableCode} onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))}
                            style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '18px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" className="btn btn-danger" disabled={loading || disableCode.length !== 6}>
                            2FA Kapat
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => { setStep('idle'); setDisableCode(''); }}>
                            Iptal
                        </button>
                    </div>
                </form>
            )}
        </SectionCard>
    );
}

// ---- Recent Audit Summary ----
function AuditSummary() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        creatorApi.getCreatorAuditLogs({ limit: 10 }).then(result => {
            setLogs(result?.logs || []);
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    return (
        <SectionCard title="Son Aktiviteler" icon={Shield}>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
            ) : logs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Aktivite bulunamadi.</p>
            ) : (
                <div>
                    {logs.slice(0, 10).map(log => (
                        <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '12px' }}>
                            <span style={{ fontWeight: 500 }}>{log.action}</span>
                            <span style={{ color: 'var(--text-muted)' }}>
                                {log.createdAt ? new Date(log.createdAt).toLocaleString('tr-TR') : '—'}
                            </span>
                        </div>
                    ))}
                    <div style={{ marginTop: '12px' }}>
                        <a href="/audit-logs" style={{ fontSize: '12px', color: 'var(--primary)' }}>Tum loglari goster</a>
                    </div>
                </div>
            )}
        </SectionCard>
    );
}

// ---- About Section ----
function AboutSection() {
    return (
        <SectionCard title="Hakkinda" icon={Info}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>Panel Versiyonu</span>
                    <div style={{ fontWeight: 600 }}>{PANEL_VERSION}</div>
                </div>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>Build Tarihi</span>
                    <div style={{ fontWeight: 600 }}>{BUILD_DATE}</div>
                </div>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>Platform</span>
                    <div style={{ fontWeight: 600 }}>Web (Vite + React)</div>
                </div>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>Backend</span>
                    <div style={{ fontWeight: 600 }}>Firebase Functions v2</div>
                </div>
            </div>
        </SectionCard>
    );
}

export default function Settings() {
    const user = auth.currentUser;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Ayarlar</h1>
            </div>

            <div style={{ maxWidth: '680px' }}>
                <ProfileSection user={user} />
                <TwoFASection user={user} />
                <AuditSummary />
                <AboutSection />
            </div>
        </div>
    );
}

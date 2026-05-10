import { useState, useEffect } from 'react';
import { RefreshCcw, Save, Loader2, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { creatorApi } from '../services/creatorApi';

const DEFAULT_CONFIG = {
    latestVersion: '',
    minRequiredVersion: '',
    channel: 'stable',
    forceUpdate: false,
    releaseNotes: ''
};

export default function Versioning() {
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => { loadConfig(); }, []);

    async function loadConfig() {
        setLoading(true);
        try {
            const res = await creatorApi.getVersioning();
            setConfig(res?.config || DEFAULT_CONFIG);
            setDirty(false);
        } catch (err) {
            toast.error('Sürüm bilgisi yüklenemedi');
        } finally {
            setLoading(false);
        }
    }

    function update(field, value) {
        setConfig(prev => ({ ...prev, [field]: value }));
        setDirty(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        if (!config.latestVersion || !config.minRequiredVersion) {
            toast.error('Sürüm alanları zorunludur');
            return;
        }
        setSaving(true);
        try {
            await creatorApi.updateVersioning(config);
            toast.success('Sürüm bilgisi güncellendi!');
            setDirty(false);
        } catch (err) {
            toast.error('Güncellenemedi: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="loader"><div className="loader-spinner"></div></div>;
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Sürüm Yönetimi</h1>
                <button className="btn btn-secondary" onClick={loadConfig}>
                    <RefreshCcw size={16} /> Yenile
                </button>
            </div>

            <div className="card" style={{ maxWidth: '600px' }}>
                <form onSubmit={handleSave}>
                    <div style={{ padding: '20px' }}>
                        <div style={{ marginBottom: '20px', padding: '12px 14px', background: 'rgba(99,102,241,0.07)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <Info size={16} style={{ flexShrink: 0, marginTop: '1px', color: 'var(--primary)' }} />
                            <span>
                                Bu ayarlar Electron istemcilerinin sürüm kontrolü için kullanılır.
                                <strong> forceUpdate</strong> aktifken minRequiredVersion altındaki istemciler uygulamayı açamaz.
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="form-group">
                                <label className="form-label">Son Sürüm *</label>
                                <input type="text" className="form-input" required
                                    placeholder="1.2.3"
                                    value={config.latestVersion}
                                    onChange={e => update('latestVersion', e.target.value)}
                                    style={{ fontFamily: 'monospace' }}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Minimum Gerekli Sürüm *</label>
                                <input type="text" className="form-input" required
                                    placeholder="1.0.0"
                                    value={config.minRequiredVersion}
                                    onChange={e => update('minRequiredVersion', e.target.value)}
                                    style={{ fontFamily: 'monospace' }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Kanal</label>
                            <select className="form-input" value={config.channel}
                                onChange={e => update('channel', e.target.value)}>
                                <option value="stable">stable</option>
                                <option value="beta">beta</option>
                                <option value="alpha">alpha</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <div style={{
                                    position: 'relative', width: '44px', height: '24px', borderRadius: '12px',
                                    background: config.forceUpdate ? '#6366f1' : 'var(--border-color)',
                                    transition: 'background 0.2s', cursor: 'pointer'
                                }} onClick={() => update('forceUpdate', !config.forceUpdate)}>
                                    <div style={{
                                        position: 'absolute', top: '3px', width: '18px', height: '18px', borderRadius: '50%',
                                        background: '#fff', transition: 'left 0.2s',
                                        left: config.forceUpdate ? '23px' : '3px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                    }} />
                                </div>
                                <span>
                                    Zorunlu Güncelleme (forceUpdate)
                                    {config.forceUpdate && (
                                        <span style={{ marginLeft: '8px', color: '#ef4444', fontWeight: 600, fontSize: '12px' }}>
                                            AKTIF — eski istemciler bloklanır!
                                        </span>
                                    )}
                                </span>
                            </label>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Sürüm Notları</label>
                            <textarea className="form-input" rows={4}
                                placeholder="Bu sürümdeki değişiklikler..."
                                value={config.releaseNotes}
                                onChange={e => update('releaseNotes', e.target.value)}
                                style={{ resize: 'vertical' }}
                            />
                        </div>
                    </div>

                    <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '16px 20px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {dirty ? 'Kaydedilmemiş değişiklikler var' : 'Tüm değişiklikler kaydedildi'}
                        </span>
                        <button type="submit" className="btn btn-primary" disabled={saving || !dirty}>
                            {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Kaydediliyor...</> : <><Save size={16} /> Kaydet</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

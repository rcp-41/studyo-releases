/**
 * BotConfigModal — Creator Panel Bot Configuration Modal
 * 
 * 3-tab modal for managing AI bot settings per studio:
 * Tab 1: Genel Ayarlar — system prompt, services, working hours
 * Tab 2: WhatsApp — Cloud API credentials, toggle, webhook URL
 * Tab 3: Voice — Twilio credentials, toggle, webhook URL
 */
import { useState, useEffect } from 'react';
import {
    X, Save, Bot, MessageSquare, Phone, Loader2, Copy, Check,
    Plus, Trash2, Clock, Send, Power, PowerOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { creatorApi } from '../services/creatorApi';

const DAYS_OF_WEEK = [
    { key: 'mon', label: 'Pzt' },
    { key: 'tue', label: 'Sal' },
    { key: 'wed', label: 'Çar' },
    { key: 'thu', label: 'Per' },
    { key: 'fri', label: 'Cum' },
    { key: 'sat', label: 'Cmt' },
    { key: 'sun', label: 'Paz' }
];

export default function BotConfigModal({ studio, onClose, onRefresh }) {
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState('');

    // Settings
    const [settings, setSettings] = useState({
        systemPrompt: '',
        greetingMessage: 'Merhaba! 📸 Size nasıl yardımcı olabilirim?',
        outOfHoursMessage: 'Şu an çalışma saatleri dışındayız. Mesai saatlerinde tekrar deneyin.',
        workingHours: { start: '09:00', end: '19:00', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] },
        dailyMessageLimit: 200,
        services: []
    });

    // WhatsApp Config
    const [waConfig, setWaConfig] = useState({
        enabled: false,
        phoneNumber: '',
        phoneNumberId: '',
        businessAccountId: '',
        accessToken: '',
        verifyToken: '',
        webhookUrl: ''
    });

    // Voice Config
    const [voiceConfig, setVoiceConfig] = useState({
        enabled: false,
        phoneNumber: '',
        twilioAccountSid: '',
        twilioAuthToken: '',
        twilioPhoneNumberSid: '',
        webhookUrl: '',
        greetingText: 'Hoş geldiniz! Size nasıl yardımcı olabilirim?'
    });

    // New service input
    const [newService, setNewService] = useState({ name: '', price: '', duration: '' });

    useEffect(() => {
        loadConfig();
    }, []);

    async function loadConfig() {
        setLoading(true);
        try {
            const result = await creatorApi.getBotConfig(studio.id, studio.organizationId);
            if (result?.data) {
                if (result.data.settings) setSettings(prev => ({ ...prev, ...result.data.settings }));
                if (result.data.whatsapp) setWaConfig(prev => ({ ...prev, ...result.data.whatsapp }));
                if (result.data.voice) setVoiceConfig(prev => ({ ...prev, ...result.data.voice }));
            }
        } catch (err) {
            console.error('Load bot config error:', err);
        } finally {
            setLoading(false);
        }
    }

    async function saveSettings() {
        setSaving(true);
        try {
            await creatorApi.updateBotSettings(studio.id, studio.organizationId, settings);
            toast.success('Bot ayarları kaydedildi');
        } catch (err) {
            toast.error('Kaydetme hatası: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    async function saveWhatsApp() {
        setSaving(true);
        try {
            const result = await creatorApi.updateBotWhatsApp(studio.id, studio.organizationId, waConfig);
            if (result?.webhookUrl) setWaConfig(prev => ({ ...prev, webhookUrl: result.webhookUrl }));
            if (result?.verifyToken) setWaConfig(prev => ({ ...prev, verifyToken: result.verifyToken }));
            toast.success('WhatsApp ayarları kaydedildi');
            if (onRefresh) onRefresh();
        } catch (err) {
            toast.error('Kaydetme hatası: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    async function saveVoice() {
        setSaving(true);
        try {
            const result = await creatorApi.updateBotVoice(studio.id, studio.organizationId, voiceConfig);
            if (result?.webhookUrl) setVoiceConfig(prev => ({ ...prev, webhookUrl: result.webhookUrl }));
            toast.success('Voice Bot ayarları kaydedildi');
            if (onRefresh) onRefresh();
        } catch (err) {
            toast.error('Kaydetme hatası: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleToggle(channel) {
        const isWhatsApp = channel === 'whatsapp';
        const currentEnabled = isWhatsApp ? waConfig.enabled : voiceConfig.enabled;
        try {
            await creatorApi.toggleBot(studio.id, studio.organizationId, channel, !currentEnabled);
            if (isWhatsApp) {
                setWaConfig(prev => ({ ...prev, enabled: !currentEnabled }));
            } else {
                setVoiceConfig(prev => ({ ...prev, enabled: !currentEnabled }));
            }
            toast.success(`${isWhatsApp ? 'WhatsApp' : 'Voice'} Bot ${!currentEnabled ? 'aktif' : 'pasif'} edildi`);
            if (onRefresh) onRefresh();
        } catch (err) {
            toast.error('Toggle hatası: ' + err.message);
        }
    }

    function copyToClipboard(text, label) {
        navigator.clipboard.writeText(text);
        setCopied(label);
        toast.success('Kopyalandı!');
        setTimeout(() => setCopied(''), 2000);
    }

    function addService() {
        if (!newService.name) return;
        setSettings(prev => ({
            ...prev,
            services: [...prev.services, { ...newService }]
        }));
        setNewService({ name: '', price: '', duration: '' });
    }

    function removeService(index) {
        setSettings(prev => ({
            ...prev,
            services: prev.services.filter((_, i) => i !== index)
        }));
    }

    function toggleDay(day) {
        setSettings(prev => {
            const days = prev.workingHours?.days || [];
            const newDays = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
            return { ...prev, workingHours: { ...prev.workingHours, days: newDays } };
        });
    }

    const tabStyle = (tab) => ({
        padding: '10px 20px',
        border: 'none',
        background: activeTab === tab ? 'var(--primary)' : 'transparent',
        color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
        cursor: 'pointer',
        borderRadius: '8px',
        fontWeight: 500,
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.15s'
    });

    const inputGroupStyle = { marginBottom: '16px' };
    const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-secondary)' };
    const monoInputStyle = { fontFamily: 'monospace', fontSize: '12px' };
    const readOnlyStyle = { ...monoInputStyle, background: 'var(--bg-secondary)', cursor: 'default' };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: '780px' }}>
                <div className="modal-header">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Bot size={22} /> AI Bot Ayarları — {studio.info?.name}
                    </h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '6px', padding: '12px 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                    <button style={tabStyle('general')} onClick={() => setActiveTab('general')}>
                        <Bot size={16} /> Genel
                    </button>
                    <button style={tabStyle('whatsapp')} onClick={() => setActiveTab('whatsapp')}>
                        <MessageSquare size={16} /> WhatsApp
                        {waConfig.enabled && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />}
                    </button>
                    <button style={tabStyle('voice')} onClick={() => setActiveTab('voice')}>
                        <Phone size={16} /> Sesli Bot
                        {voiceConfig.enabled && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />}
                    </button>
                </div>

                <div className="modal-body" style={{ padding: '20px', maxHeight: '60vh', overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
                        </div>
                    ) : (
                        <>
                            {/* ─── GENEL TAB ─── */}
                            {activeTab === 'general' && (
                                <div>
                                    <div style={inputGroupStyle}>
                                        <label style={labelStyle}>System Prompt (Bot Kişiliği)</label>
                                        <textarea className="form-input" rows={5}
                                            placeholder="Örn: Sen profesyonel bir fotoğraf stüdyosu asistanısın..."
                                            value={settings.systemPrompt}
                                            onChange={e => setSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
                                            style={{ resize: 'vertical', minHeight: '100px' }}
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div style={inputGroupStyle}>
                                            <label style={labelStyle}>Karşılama Mesajı</label>
                                            <input type="text" className="form-input"
                                                value={settings.greetingMessage}
                                                onChange={e => setSettings(prev => ({ ...prev, greetingMessage: e.target.value }))}
                                            />
                                        </div>
                                        <div style={inputGroupStyle}>
                                            <label style={labelStyle}>Mesai Dışı Mesajı</label>
                                            <input type="text" className="form-input"
                                                value={settings.outOfHoursMessage}
                                                onChange={e => setSettings(prev => ({ ...prev, outOfHoursMessage: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    {/* Working Hours */}
                                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <Clock size={16} />
                                            <span style={{ fontWeight: 600, fontSize: '14px' }}>Çalışma Saatleri</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                                            <input type="time" className="form-input" style={{ width: '120px' }}
                                                value={settings.workingHours?.start || '09:00'}
                                                onChange={e => setSettings(prev => ({ ...prev, workingHours: { ...prev.workingHours, start: e.target.value } }))}
                                            />
                                            <span>—</span>
                                            <input type="time" className="form-input" style={{ width: '120px' }}
                                                value={settings.workingHours?.end || '19:00'}
                                                onChange={e => setSettings(prev => ({ ...prev, workingHours: { ...prev.workingHours, end: e.target.value } }))}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {DAYS_OF_WEEK.map(day => (
                                                <button key={day.key} type="button"
                                                    onClick={() => toggleDay(day.key)}
                                                    style={{
                                                        padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--border-color)',
                                                        fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                                                        background: (settings.workingHours?.days || []).includes(day.key) ? 'var(--primary)' : 'transparent',
                                                        color: (settings.workingHours?.days || []).includes(day.key) ? '#fff' : 'var(--text-secondary)'
                                                    }}>
                                                    {day.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={inputGroupStyle}>
                                        <label style={labelStyle}>Günlük Mesaj Limiti</label>
                                        <input type="number" className="form-input" style={{ width: '120px' }}
                                            value={settings.dailyMessageLimit}
                                            onChange={e => setSettings(prev => ({ ...prev, dailyMessageLimit: parseInt(e.target.value) || 200 }))}
                                        />
                                    </div>

                                    {/* Services */}
                                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                        <span style={{ fontWeight: 600, fontSize: '14px', display: 'block', marginBottom: '12px' }}>Hizmetler & Fiyatlar</span>
                                        {settings.services.map((svc, i) => (
                                            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{ flex: 2, fontSize: '13px' }}>{svc.name}</span>
                                                <span style={{ flex: 1, fontSize: '13px', color: 'var(--primary)' }}>{svc.price}</span>
                                                <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-muted)' }}>{svc.duration}</span>
                                                <button type="button" onClick={() => removeService(i)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                                            <input type="text" className="form-input" placeholder="Hizmet adı" style={{ flex: 2, fontSize: '13px' }}
                                                value={newService.name} onChange={e => setNewService(p => ({ ...p, name: e.target.value }))} />
                                            <input type="text" className="form-input" placeholder="Fiyat" style={{ flex: 1, fontSize: '13px' }}
                                                value={newService.price} onChange={e => setNewService(p => ({ ...p, price: e.target.value }))} />
                                            <input type="text" className="form-input" placeholder="Süre" style={{ flex: 1, fontSize: '13px' }}
                                                value={newService.duration} onChange={e => setNewService(p => ({ ...p, duration: e.target.value }))} />
                                            <button type="button" onClick={addService} className="btn btn-primary btn-sm" style={{ padding: '8px' }}>
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ─── WHATSAPP TAB ─── */}
                            {activeTab === 'whatsapp' && (
                                <div>
                                    {/* Enable/Disable Toggle */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '14px 16px', borderRadius: '10px', marginBottom: '20px',
                                        background: waConfig.enabled ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.06)',
                                        border: `1px solid ${waConfig.enabled ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {waConfig.enabled ? <Power size={20} color="#22c55e" /> : <PowerOff size={20} color="#ef4444" />}
                                            <span style={{ fontWeight: 600, color: waConfig.enabled ? '#22c55e' : '#ef4444' }}>
                                                WhatsApp Bot — {waConfig.enabled ? 'AKTİF' : 'PASİF'}
                                            </span>
                                        </div>
                                        <button type="button" className={`btn btn-sm ${waConfig.enabled ? 'btn-danger' : 'btn-primary'}`}
                                            onClick={() => handleToggle('whatsapp')}>
                                            {waConfig.enabled ? 'Kapat' : 'Aktifleştir'}
                                        </button>
                                    </div>

                                    <div style={inputGroupStyle}>
                                        <label style={labelStyle}>Telefon Numarası</label>
                                        <input type="text" className="form-input" placeholder="+905551234567"
                                            value={waConfig.phoneNumber}
                                            onChange={e => setWaConfig(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                        />
                                    </div>
                                    <div style={inputGroupStyle}>
                                        <label style={labelStyle}>Phone Number ID (Meta)</label>
                                        <input type="text" className="form-input" placeholder="1234567890" style={monoInputStyle}
                                            value={waConfig.phoneNumberId}
                                            onChange={e => setWaConfig(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                                        />
                                    </div>
                                    <div style={inputGroupStyle}>
                                        <label style={labelStyle}>Business Account ID</label>
                                        <input type="text" className="form-input" style={monoInputStyle}
                                            value={waConfig.businessAccountId}
                                            onChange={e => setWaConfig(prev => ({ ...prev, businessAccountId: e.target.value }))}
                                        />
                                    </div>
                                    <div style={inputGroupStyle}>
                                        <label style={labelStyle}>Access Token</label>
                                        <input type="password" className="form-input" placeholder="EAA..." style={monoInputStyle}
                                            value={waConfig.accessToken}
                                            onChange={e => setWaConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                                        />
                                    </div>

                                    {/* Read-only fields */}
                                    {waConfig.verifyToken && (
                                        <div style={inputGroupStyle}>
                                            <label style={labelStyle}>Verify Token (otomatik)</label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input type="text" className="form-input" value={waConfig.verifyToken} readOnly style={readOnlyStyle} />
                                                <button type="button" className="btn btn-secondary btn-sm"
                                                    onClick={() => copyToClipboard(waConfig.verifyToken, 'verify')}>
                                                    {copied === 'verify' ? <Check size={14} /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {waConfig.webhookUrl && (
                                        <div style={inputGroupStyle}>
                                            <label style={labelStyle}>Webhook URL (Meta'ya yapıştır)</label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input type="text" className="form-input" value={waConfig.webhookUrl} readOnly style={readOnlyStyle} />
                                                <button type="button" className="btn btn-secondary btn-sm"
                                                    onClick={() => copyToClipboard(waConfig.webhookUrl, 'waWebhook')}>
                                                    {copied === 'waWebhook' ? <Check size={14} /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ─── VOICE TAB ─── */}
                            {activeTab === 'voice' && (
                                <div>
                                    {/* Enable/Disable Toggle */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '14px 16px', borderRadius: '10px', marginBottom: '20px',
                                        background: voiceConfig.enabled ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.06)',
                                        border: `1px solid ${voiceConfig.enabled ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {voiceConfig.enabled ? <Power size={20} color="#22c55e" /> : <PowerOff size={20} color="#ef4444" />}
                                            <span style={{ fontWeight: 600, color: voiceConfig.enabled ? '#22c55e' : '#ef4444' }}>
                                                Voice Bot — {voiceConfig.enabled ? 'AKTİF' : 'PASİF'}
                                            </span>
                                        </div>
                                        <button type="button" className={`btn btn-sm ${voiceConfig.enabled ? 'btn-danger' : 'btn-primary'}`}
                                            onClick={() => handleToggle('voice')}>
                                            {voiceConfig.enabled ? 'Kapat' : 'Aktifleştir'}
                                        </button>
                                    </div>

                                    <div style={inputGroupStyle}>
                                        <label style={labelStyle}>Twilio Telefon Numarası</label>
                                        <input type="text" className="form-input" placeholder="+902121234567"
                                            value={voiceConfig.phoneNumber}
                                            onChange={e => setVoiceConfig(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                        />
                                    </div>
                                    <div style={inputGroupStyle}>
                                        <label style={labelStyle}>Twilio Account SID</label>
                                        <input type="text" className="form-input" placeholder="AC..." style={monoInputStyle}
                                            value={voiceConfig.twilioAccountSid}
                                            onChange={e => setVoiceConfig(prev => ({ ...prev, twilioAccountSid: e.target.value }))}
                                        />
                                    </div>
                                    <div style={inputGroupStyle}>
                                        <label style={labelStyle}>Twilio Auth Token</label>
                                        <input type="password" className="form-input" style={monoInputStyle}
                                            value={voiceConfig.twilioAuthToken}
                                            onChange={e => setVoiceConfig(prev => ({ ...prev, twilioAuthToken: e.target.value }))}
                                        />
                                    </div>
                                    <div style={inputGroupStyle}>
                                        <label style={labelStyle}>Karşılama Metni</label>
                                        <textarea className="form-input" rows={2}
                                            value={voiceConfig.greetingText}
                                            onChange={e => setVoiceConfig(prev => ({ ...prev, greetingText: e.target.value }))}
                                        />
                                    </div>

                                    {voiceConfig.webhookUrl && (
                                        <div style={inputGroupStyle}>
                                            <label style={labelStyle}>Webhook URL (Twilio'ya yapıştır)</label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input type="text" className="form-input" value={voiceConfig.webhookUrl} readOnly style={readOnlyStyle} />
                                                <button type="button" className="btn btn-secondary btn-sm"
                                                    onClick={() => copyToClipboard(voiceConfig.webhookUrl, 'voiceWebhook')}>
                                                    {copied === 'voiceWebhook' ? <Check size={14} /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>Kapat</button>
                    <button type="button" className="btn btn-primary" disabled={saving || loading}
                        onClick={() => {
                            if (activeTab === 'general') saveSettings();
                            else if (activeTab === 'whatsapp') saveWhatsApp();
                            else if (activeTab === 'voice') saveVoice();
                        }}>
                        {saving ? (
                            <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Kaydediliyor...</>
                        ) : (
                            <><Save size={16} /> Kaydet</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

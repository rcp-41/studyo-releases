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
    Plus, Trash2, Clock, Send, Power, PowerOff, MapPin, Info,
    CreditCard, HelpCircle, Tag, ShieldAlert, Building2, Instagram,
    Eye, EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { creatorApi } from '../services/creatorApi';

const SECRET_MASK = '••••••••';

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

    // Secret masking state
    const [secretState, setSecretState] = useState({
        hasStoredWaToken: false, waTokenChanged: false, waTokenVisible: false,
        hasStoredTwilioToken: false, twilioTokenChanged: false, twilioTokenVisible: false
    });

    // New service input
    const [newService, setNewService] = useState({ name: '', price: '', duration: '' });

    // Studio Info
    const [studioInfo, setStudioInfo] = useState({
        address: '', directions: '', mapsUrl: '',
        phone: '', email: '', instagram: '', website: '',
        about: '', specialties: '',
        appointmentDuration: '', breakBetween: '', maxDailyAppointments: '',
        bankName: '', iban: '', accountHolder: '', depositAmount: '', paymentNotes: '',
        faq: [], campaigns: [], restrictions: ''
    });
    const [newFaq, setNewFaq] = useState({ question: '', answer: '' });
    const [newCampaign, setNewCampaign] = useState({ name: '', details: '' });

    useEffect(() => {
        loadConfig();
    }, []);

    async function loadConfig() {
        setLoading(true);
        try {
            const result = await creatorApi.getBotConfig(studio.id, studio.organizationId);
            if (result?.data) {
                if (result.data.settings) setSettings(prev => ({ ...prev, ...result.data.settings }));
                if (result.data.whatsapp) {
                    const wa = { ...result.data.whatsapp };
                    const hasStoredWaToken = !!wa.accessToken;
                    if (hasStoredWaToken) wa.accessToken = SECRET_MASK;
                    setWaConfig(prev => ({ ...prev, ...wa }));
                    setSecretState(s => ({ ...s, hasStoredWaToken, waTokenChanged: false, waTokenVisible: false }));
                }
                if (result.data.voice) {
                    const v = { ...result.data.voice };
                    const hasStoredTwilioToken = !!v.twilioAuthToken;
                    if (hasStoredTwilioToken) v.twilioAuthToken = SECRET_MASK;
                    setVoiceConfig(prev => ({ ...prev, ...v }));
                    setSecretState(s => ({ ...s, hasStoredTwilioToken, twilioTokenChanged: false, twilioTokenVisible: false }));
                }
                if (result.data.studioInfo) setStudioInfo(prev => ({ ...prev, ...result.data.studioInfo }));
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
            const payload = { ...waConfig };
            if (secretState.hasStoredWaToken && !secretState.waTokenChanged) {
                delete payload.accessToken;
            }
            const result = await creatorApi.updateBotWhatsApp(studio.id, studio.organizationId, payload);
            if (result?.webhookUrl) setWaConfig(prev => ({ ...prev, webhookUrl: result.webhookUrl }));
            if (result?.verifyToken) setWaConfig(prev => ({ ...prev, verifyToken: result.verifyToken }));
            if (secretState.waTokenChanged) {
                setWaConfig(prev => ({ ...prev, accessToken: SECRET_MASK }));
                setSecretState(s => ({ ...s, hasStoredWaToken: true, waTokenChanged: false, waTokenVisible: false }));
            }
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
            const payload = { ...voiceConfig };
            if (secretState.hasStoredTwilioToken && !secretState.twilioTokenChanged) {
                delete payload.twilioAuthToken;
            }
            const result = await creatorApi.updateBotVoice(studio.id, studio.organizationId, payload);
            if (result?.webhookUrl) setVoiceConfig(prev => ({ ...prev, webhookUrl: result.webhookUrl }));
            if (secretState.twilioTokenChanged) {
                setVoiceConfig(prev => ({ ...prev, twilioAuthToken: SECRET_MASK }));
                setSecretState(s => ({ ...s, hasStoredTwilioToken: true, twilioTokenChanged: false, twilioTokenVisible: false }));
            }
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

    async function saveStudioInfo() {
        setSaving(true);
        try {
            await creatorApi.updateBotStudioInfo(studio.id, studio.organizationId, studioInfo);
            toast.success('Stüdyo bilgileri kaydedildi');
        } catch (err) {
            toast.error('Kaydetme hatası: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    function addFaq() {
        if (!newFaq.question || !newFaq.answer) return;
        setStudioInfo(prev => ({ ...prev, faq: [...(prev.faq || []), { ...newFaq }] }));
        setNewFaq({ question: '', answer: '' });
    }
    function removeFaq(index) {
        setStudioInfo(prev => ({ ...prev, faq: prev.faq.filter((_, i) => i !== index) }));
    }

    function addCampaign() {
        if (!newCampaign.name) return;
        setStudioInfo(prev => ({ ...prev, campaigns: [...(prev.campaigns || []), { ...newCampaign, active: true }] }));
        setNewCampaign({ name: '', details: '' });
    }
    function removeCampaign(index) {
        setStudioInfo(prev => ({ ...prev, campaigns: prev.campaigns.filter((_, i) => i !== index) }));
    }
    function toggleCampaign(index) {
        setStudioInfo(prev => ({
            ...prev,
            campaigns: prev.campaigns.map((c, i) => i === index ? { ...c, active: !c.active } : c)
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
                    <button style={tabStyle('studioInfo')} onClick={() => setActiveTab('studioInfo')}>
                        <Building2 size={16} /> Stüdyo Bilgileri
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

                            {/* ─── STÜDYO BİLGİLERİ TAB ─── */}
                            {activeTab === 'studioInfo' && (
                                <div>
                                    {/* Address & Location */}
                                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <MapPin size={16} color="var(--primary)" />
                                            <span style={{ fontWeight: 600, fontSize: '14px' }}>Adres & Konum</span>
                                        </div>
                                        <div style={inputGroupStyle}>
                                            <label style={labelStyle}>Stüdyo Adresi</label>
                                            <textarea className="form-input" rows={2}
                                                placeholder="Örn: Atatürk Caddesi No:42, Kat:3, İzmit/Kocaeli"
                                                value={studioInfo.address}
                                                onChange={e => setStudioInfo(prev => ({ ...prev, address: e.target.value }))}
                                            />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div style={inputGroupStyle}>
                                                <label style={labelStyle}>Yol Tarifi</label>
                                                <input type="text" className="form-input" placeholder="Metro çıkışının karşısı..."
                                                    value={studioInfo.directions}
                                                    onChange={e => setStudioInfo(prev => ({ ...prev, directions: e.target.value }))} />
                                            </div>
                                            <div style={inputGroupStyle}>
                                                <label style={labelStyle}>Google Maps Linki</label>
                                                <input type="url" className="form-input" placeholder="https://maps.google.com/..."
                                                    value={studioInfo.mapsUrl}
                                                    onChange={e => setStudioInfo(prev => ({ ...prev, mapsUrl: e.target.value }))} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contact Info */}
                                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <Phone size={16} color="var(--primary)" />
                                            <span style={{ fontWeight: 600, fontSize: '14px' }}>İletişim Bilgileri</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div style={inputGroupStyle}>
                                                <label style={labelStyle}>Telefon</label>
                                                <input type="tel" className="form-input" placeholder="0532 123 45 67"
                                                    value={studioInfo.phone}
                                                    onChange={e => setStudioInfo(prev => ({ ...prev, phone: e.target.value }))} />
                                            </div>
                                            <div style={inputGroupStyle}>
                                                <label style={labelStyle}>E-posta</label>
                                                <input type="email" className="form-input" placeholder="info@studyo.com"
                                                    value={studioInfo.email}
                                                    onChange={e => setStudioInfo(prev => ({ ...prev, email: e.target.value }))} />
                                            </div>
                                            <div style={inputGroupStyle}>
                                                <label style={labelStyle}><Instagram size={13} style={{ marginRight: 4 }} />Instagram</label>
                                                <input type="text" className="form-input" placeholder="@studyoadi"
                                                    value={studioInfo.instagram}
                                                    onChange={e => setStudioInfo(prev => ({ ...prev, instagram: e.target.value }))} />
                                            </div>
                                            <div style={inputGroupStyle}>
                                                <label style={labelStyle}>Web Sitesi</label>
                                                <input type="url" className="form-input" placeholder="https://studyo.com"
                                                    value={studioInfo.website}
                                                    onChange={e => setStudioInfo(prev => ({ ...prev, website: e.target.value }))} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* About */}
                                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <Info size={16} color="var(--primary)" />
                                            <span style={{ fontWeight: 600, fontSize: '14px' }}>Stüdyo Hakkında</span>
                                        </div>
                                        <div style={inputGroupStyle}>
                                            <label style={labelStyle}>Tanıtım Metni</label>
                                            <textarea className="form-input" rows={3}
                                                placeholder="Stüdyonuzun kısa tanıtımı..."
                                                value={studioInfo.about}
                                                onChange={e => setStudioInfo(prev => ({ ...prev, about: e.target.value }))}
                                                style={{ resize: 'vertical' }}
                                            />
                                        </div>
                                        <div style={inputGroupStyle}>
                                            <label style={labelStyle}>Uzmanlık Alanları</label>
                                            <input type="text" className="form-input" placeholder="Düğün, Doğum, Bebek, Vesikalık, Ürün…"
                                                value={studioInfo.specialties}
                                                onChange={e => setStudioInfo(prev => ({ ...prev, specialties: e.target.value }))} />
                                        </div>
                                    </div>

                                    {/* Appointment Settings */}
                                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <Clock size={16} color="var(--primary)" />
                                            <span style={{ fontWeight: 600, fontSize: '14px' }}>Randevu Ayarları</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                            <div style={inputGroupStyle}>
                                                <label style={labelStyle}>Seans Süresi (dk)</label>
                                                <input type="number" className="form-input" placeholder="60"
                                                    value={studioInfo.appointmentDuration}
                                                    onChange={e => setStudioInfo(prev => ({ ...prev, appointmentDuration: e.target.value }))} />
                                            </div>
                                            <div style={inputGroupStyle}>
                                                <label style={labelStyle}>Arası Mola (dk)</label>
                                                <input type="number" className="form-input" placeholder="15"
                                                    value={studioInfo.breakBetween}
                                                    onChange={e => setStudioInfo(prev => ({ ...prev, breakBetween: e.target.value }))} />
                                            </div>
                                            <div style={inputGroupStyle}>
                                                <label style={labelStyle}>Max Günlük</label>
                                                <input type="number" className="form-input" placeholder="8"
                                                    value={studioInfo.maxDailyAppointments}
                                                    onChange={e => setStudioInfo(prev => ({ ...prev, maxDailyAppointments: e.target.value }))} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Payment Info */}
                                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <CreditCard size={16} color="var(--primary)" />
                                            <span style={{ fontWeight: 600, fontSize: '14px' }}>Ödeme Bilgileri</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div style={inputGroupStyle}>
                                                <label style={labelStyle}>Banka Adı</label>
                                                <input type="text" className="form-input" placeholder="Ziraat Bankası"
                                                    value={studioInfo.bankName}
                                                    onChange={e => setStudioInfo(prev => ({ ...prev, bankName: e.target.value }))} />
                                            </div>
                                            <div style={inputGroupStyle}>
                                                <label style={labelStyle}>Hesap Sahibi</label>
                                                <input type="text" className="form-input" placeholder="Ad Soyad"
                                                    value={studioInfo.accountHolder}
                                                    onChange={e => setStudioInfo(prev => ({ ...prev, accountHolder: e.target.value }))} />
                                            </div>
                                        </div>
                                        <div style={inputGroupStyle}>
                                            <label style={labelStyle}>IBAN</label>
                                            <input type="text" className="form-input" placeholder="TR00 0000 0000 0000 0000 0000 00" style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
                                                value={studioInfo.iban}
                                                onChange={e => setStudioInfo(prev => ({ ...prev, iban: e.target.value }))} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div style={inputGroupStyle}>
                                                <label style={labelStyle}>Kapora Miktarı</label>
                                                <input type="text" className="form-input" placeholder="500₺"
                                                    value={studioInfo.depositAmount}
                                                    onChange={e => setStudioInfo(prev => ({ ...prev, depositAmount: e.target.value }))} />
                                            </div>
                                            <div style={inputGroupStyle}>
                                                <label style={labelStyle}>Ödeme Notu</label>
                                                <input type="text" className="form-input" placeholder="Çekim öncesi kapora alınır"
                                                    value={studioInfo.paymentNotes}
                                                    onChange={e => setStudioInfo(prev => ({ ...prev, paymentNotes: e.target.value }))} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* FAQ */}
                                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <HelpCircle size={16} color="var(--primary)" />
                                            <span style={{ fontWeight: 600, fontSize: '14px' }}>Sık Sorulan Sorular</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{(studioInfo.faq || []).length} soru</span>
                                        </div>
                                        {(studioInfo.faq || []).map((faq, i) => (
                                            <div key={i} style={{ padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '8px', marginBottom: '8px', border: '1px solid var(--border-color)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>S: {faq.question}</div>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>C: {faq.answer}</div>
                                                    </div>
                                                    <button type="button" onClick={() => removeFaq(i)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', flexShrink: 0 }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                            <input type="text" className="form-input" placeholder="Soru" style={{ flex: 1, fontSize: '13px' }}
                                                value={newFaq.question} onChange={e => setNewFaq(p => ({ ...p, question: e.target.value }))} />
                                            <input type="text" className="form-input" placeholder="Cevap" style={{ flex: 1, fontSize: '13px' }}
                                                value={newFaq.answer} onChange={e => setNewFaq(p => ({ ...p, answer: e.target.value }))} />
                                            <button type="button" onClick={addFaq} className="btn btn-primary btn-sm" style={{ padding: '8px' }}>
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Campaigns */}
                                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <Tag size={16} color="var(--primary)" />
                                            <span style={{ fontWeight: 600, fontSize: '14px' }}>Kampanyalar</span>
                                        </div>
                                        {(studioInfo.campaigns || []).map((camp, i) => (
                                            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', opacity: camp.active !== false ? 1 : 0.5 }}>
                                                <button type="button" onClick={() => toggleCampaign(i)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
                                                    {camp.active !== false
                                                        ? <Power size={14} color="#22c55e" />
                                                        : <PowerOff size={14} color="#ef4444" />}
                                                </button>
                                                <span style={{ flex: 1, fontSize: '13px', fontWeight: 500 }}>{camp.name}</span>
                                                <span style={{ flex: 2, fontSize: '12px', color: 'var(--text-secondary)' }}>{camp.details}</span>
                                                <button type="button" onClick={() => removeCampaign(i)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                            <input type="text" className="form-input" placeholder="Kampanya adı" style={{ flex: 1, fontSize: '13px' }}
                                                value={newCampaign.name} onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))} />
                                            <input type="text" className="form-input" placeholder="Detay (opsiyonel)" style={{ flex: 2, fontSize: '13px' }}
                                                value={newCampaign.details} onChange={e => setNewCampaign(p => ({ ...p, details: e.target.value }))} />
                                            <button type="button" onClick={addCampaign} className="btn btn-primary btn-sm" style={{ padding: '8px' }}>
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Restrictions */}
                                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <ShieldAlert size={16} color="#ef4444" />
                                            <span style={{ fontWeight: 600, fontSize: '14px', color: '#ef4444' }}>Kısıtlamalar</span>
                                        </div>
                                        <textarea className="form-input" rows={3}
                                            placeholder="Botun yapmaması gereken şeyler. Örn:
Fiyat kırma veya indirim sözü verme.
Rakip stüdyolardan bahsetme.
Kişisel bilgi paylaşma."
                                            value={studioInfo.restrictions}
                                            onChange={e => setStudioInfo(prev => ({ ...prev, restrictions: e.target.value }))}
                                            style={{ resize: 'vertical', borderColor: 'rgba(239,68,68,0.2)' }}
                                        />
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
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input type={secretState.waTokenVisible ? 'text' : 'password'} className="form-input" placeholder="EAA..."
                                                    style={{ ...monoInputStyle, paddingRight: '40px' }}
                                                    value={waConfig.accessToken}
                                                    disabled={secretState.hasStoredWaToken && !secretState.waTokenChanged}
                                                    onChange={e => setWaConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                                                />
                                                {(!secretState.hasStoredWaToken || secretState.waTokenChanged) && (
                                                    <button type="button"
                                                        onClick={() => setSecretState(s => ({ ...s, waTokenVisible: !s.waTokenVisible }))}
                                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                                                        {secretState.waTokenVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </button>
                                                )}
                                            </div>
                                            {secretState.hasStoredWaToken && !secretState.waTokenChanged && (
                                                <button type="button" className="btn btn-secondary btn-sm"
                                                    onClick={() => {
                                                        setWaConfig(prev => ({ ...prev, accessToken: '' }));
                                                        setSecretState(s => ({ ...s, waTokenChanged: true }));
                                                    }}>
                                                    Değiştir
                                                </button>
                                            )}
                                        </div>
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
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input type={secretState.twilioTokenVisible ? 'text' : 'password'} className="form-input"
                                                    style={{ ...monoInputStyle, paddingRight: '40px' }}
                                                    value={voiceConfig.twilioAuthToken}
                                                    disabled={secretState.hasStoredTwilioToken && !secretState.twilioTokenChanged}
                                                    onChange={e => setVoiceConfig(prev => ({ ...prev, twilioAuthToken: e.target.value }))}
                                                />
                                                {(!secretState.hasStoredTwilioToken || secretState.twilioTokenChanged) && (
                                                    <button type="button"
                                                        onClick={() => setSecretState(s => ({ ...s, twilioTokenVisible: !s.twilioTokenVisible }))}
                                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                                                        {secretState.twilioTokenVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </button>
                                                )}
                                            </div>
                                            {secretState.hasStoredTwilioToken && !secretState.twilioTokenChanged && (
                                                <button type="button" className="btn btn-secondary btn-sm"
                                                    onClick={() => {
                                                        setVoiceConfig(prev => ({ ...prev, twilioAuthToken: '' }));
                                                        setSecretState(s => ({ ...s, twilioTokenChanged: true }));
                                                    }}>
                                                    Değiştir
                                                </button>
                                            )}
                                        </div>
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
                            else if (activeTab === 'studioInfo') saveStudioInfo();
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

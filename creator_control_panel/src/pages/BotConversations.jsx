/**
 * BotConversations — Creator Panel Bot Conversations Page
 * 
 * View conversations, filter by channel (WhatsApp/Voice), see messages.
 * Also used in the studio client app (read-only variant).
 */
import { useState, useEffect, useRef } from 'react';
import {
    MessageSquare, Phone, Bot, ArrowLeft, Search, Filter,
    Calendar, User, Loader2, ChevronRight, MessageCircle
} from 'lucide-react';
import { creatorApi } from '../services/creatorApi';

export default function BotConversations({ studioId, organizationId, studioName, onBack }) {
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [loading, setLoading] = useState(true);
    const [msgLoading, setMsgLoading] = useState(false);
    const [filter, setFilter] = useState('all'); // 'all' | 'whatsapp' | 'voice'
    const [searchTerm, setSearchTerm] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        loadConversations();
    }, [filter]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    async function loadConversations() {
        setLoading(true);
        try {
            const result = await creatorApi.getBotConversations(
                studioId, organizationId,
                filter === 'all' ? undefined : filter,
                50
            );
            setConversations(result?.data || []);
        } catch (err) {
            console.error('Load conversations error:', err);
        } finally {
            setLoading(false);
        }
    }

    async function openConversation(conv) {
        setSelectedConv(conv);
        setMsgLoading(true);
        try {
            const result = await creatorApi.getBotMessages(studioId, organizationId, conv.id, 100);
            setMessages(result?.data || []);
        } catch (err) {
            console.error('Load messages error:', err);
        } finally {
            setMsgLoading(false);
        }
    }

    function formatTime(ts) {
        if (!ts) return '';
        const d = ts._seconds ? new Date(ts._seconds * 1000) : new Date(ts);
        return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    const filteredConversations = conversations.filter(c => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (c.customerName || '').toLowerCase().includes(term) || (c.phone || '').includes(term);
    });

    const channelIcon = (channel) =>
        channel === 'whatsapp'
            ? <MessageSquare size={14} color="#25d366" />
            : <Phone size={14} color="#6366f1" />;

    const filterBtn = (key, label, icon) => (
        <button
            onClick={() => setFilter(key)}
            style={{
                padding: '7px 16px', borderRadius: '20px', border: '1px solid var(--border-color)',
                fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: '6px', transition: 'all 0.15s',
                background: filter === key ? 'var(--primary)' : 'transparent',
                color: filter === key ? '#fff' : 'var(--text-secondary)'
            }}>
            {icon} {label}
        </button>
    );

    return (
        <div>
            {/* Header */}
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {onBack && (
                        <button className="btn btn-secondary btn-sm" onClick={onBack}>
                            <ArrowLeft size={16} />
                        </button>
                    )}
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Bot size={24} /> Konuşmalar
                        {studioName && <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 400 }}>— {studioName}</span>}
                    </h1>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                {filterBtn('all', 'Tümü', <MessageCircle size={14} />)}
                {filterBtn('whatsapp', 'WhatsApp', <MessageSquare size={14} />)}
                {filterBtn('voice', 'Sesli', <Phone size={14} />)}
                <div style={{ flex: 1 }} />
                <div style={{ position: 'relative', minWidth: '220px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input type="text" className="form-input" placeholder="Ara..."
                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '36px', fontSize: '13px' }} />
                </div>
            </div>

            {/* Content */}
            <div style={{ display: 'grid', gridTemplateColumns: selectedConv ? '360px 1fr' : '1fr', gap: '16px', minHeight: '500px' }}>
                {/* Conversation List */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                        </div>
                    ) : filteredConversations.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                            <Bot size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                            <p>Henüz konuşma yok.</p>
                        </div>
                    ) : (
                        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                            {filteredConversations.map(conv => (
                                <div key={conv.id}
                                    onClick={() => openConversation(conv)}
                                    style={{
                                        padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                                        borderBottom: '1px solid var(--border-color)', transition: 'background 0.1s',
                                        background: selectedConv?.id === conv.id ? 'rgba(99,102,241,0.08)' : 'transparent'
                                    }}
                                    onMouseEnter={e => { if (selectedConv?.id !== conv.id) e.currentTarget.style.background = 'var(--bg-hover, rgba(0,0,0,0.02))'; }}
                                    onMouseLeave={e => { if (selectedConv?.id !== conv.id) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '50%',
                                        background: 'linear-gradient(135deg, var(--primary), #8b5cf6)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: '14px', flexShrink: 0
                                    }}>
                                        {(conv.customerName || '?')[0].toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: 500, fontSize: '14px' }}>{conv.customerName || conv.phone || 'Bilinmeyen'}</span>
                                            {channelIcon(conv.channel)}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {conv.phone} · {conv.messageCount || 0} mesaj
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                                        {formatTime(conv.lastMessage)}
                                    </div>
                                    <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Message Detail */}
                {selectedConv && (
                    <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
                        {/* Chat Header */}
                        <div style={{
                            padding: '14px 20px', borderBottom: '1px solid var(--border-color)',
                            display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-secondary)'
                        }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--primary), #8b5cf6)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: '14px'
                            }}>
                                {(selectedConv.customerName || '?')[0].toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '14px' }}>{selectedConv.customerName || 'Bilinmeyen'}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {channelIcon(selectedConv.channel)} {selectedConv.phone}
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto', maxHeight: '500px', background: 'rgba(0,0,0,0.01)' }}>
                            {msgLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                                    <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                                </div>
                            ) : messages.length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>Mesaj yok.</div>
                            ) : (
                                messages.map((msg, i) => (
                                    <div key={msg.id || i} style={{
                                        display: 'flex', justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end',
                                        marginBottom: '10px'
                                    }}>
                                        <div style={{
                                            maxWidth: '70%', padding: '10px 14px', borderRadius: '14px',
                                            fontSize: '13px', lineHeight: '1.5',
                                            background: msg.role === 'user' ? 'var(--bg-secondary)' : 'rgba(99,102,241,0.12)',
                                            color: 'var(--text-primary)',
                                            border: `1px solid ${msg.role === 'user' ? 'var(--border-color)' : 'rgba(99,102,241,0.2)'}`
                                        }}>
                                            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                                                {formatTime(msg.timestamp)}
                                                {msg.action && <span style={{ marginLeft: '6px', color: '#22c55e' }}>• {msg.action}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

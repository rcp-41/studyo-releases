/**
 * BotConversations — Studio Client App (read-only)
 * Studio admins can view bot conversations from the Dashboard link.
 */
import { useState, useEffect, useRef } from 'react';
import {
    MessageSquare, Phone, Bot, ArrowLeft, Search,
    Loader2, ChevronRight, MessageCircle
} from 'lucide-react';
import { botApi } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function BotConversations() {
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [loading, setLoading] = useState(true);
    const [msgLoading, setMsgLoading] = useState(false);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => { loadConversations(); }, [filter]);
    useEffect(() => {
        if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    async function loadConversations() {
        setLoading(true);
        try {
            const result = await botApi.getConversations(filter === 'all' ? undefined : filter, 50);
            setConversations(result?.data || []);
        } catch { }
        setLoading(false);
    }

    async function openConversation(conv) {
        setSelectedConv(conv);
        setMsgLoading(true);
        try {
            const result = await botApi.getMessages(conv.id, 100);
            setMessages(result?.data || []);
        } catch { }
        setMsgLoading(false);
    }

    function formatTime(ts) {
        if (!ts) return '';
        const d = ts._seconds ? new Date(ts._seconds * 1000) : new Date(ts);
        return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    const filtered = conversations.filter(c => {
        if (!searchTerm) return true;
        const t = searchTerm.toLowerCase();
        return (c.customerName || '').toLowerCase().includes(t) || (c.phone || '').includes(t);
    });

    const channelIcon = (ch) => ch === 'whatsapp'
        ? <MessageSquare className="w-4 h-4 text-green-500" />
        : <Phone className="w-4 h-4 text-purple-500" />;

    const filterBtn = (key, label, icon) => (
        <button onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 border
                ${filter === key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:bg-muted'}`}>
            {icon} {label}
        </button>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg bg-card border border-border hover:bg-muted transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="w-6 h-6 text-purple-500" /> Bot Konuşmaları</h1>
                        <p className="text-muted-foreground text-sm">AI Bot ile yapılan konuşma geçmişi</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
                {filterBtn('all', 'Tümü', <MessageCircle className="w-4 h-4" />)}
                {filterBtn('whatsapp', 'WhatsApp', <MessageSquare className="w-4 h-4" />)}
                {filterBtn('voice', 'Sesli', <Phone className="w-4 h-4" />)}
                <div className="flex-1" />
                <div className="relative min-w-[220px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" placeholder="Ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
            </div>

            <div className={`grid gap-6 ${selectedConv ? 'grid-cols-[360px_1fr]' : 'grid-cols-1'}`} style={{ minHeight: '500px' }}>
                {/* List */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <Bot className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p>Henüz konuşma yok.</p>
                        </div>
                    ) : (
                        <div className="max-h-[600px] overflow-y-auto">
                            {filtered.map(conv => (
                                <div key={conv.id} onClick={() => openConversation(conv)}
                                    className={`flex items-center gap-3 px-4 py-3.5 border-b border-border cursor-pointer transition-colors
                                        ${selectedConv?.id === conv.id ? 'bg-primary/5' : 'hover:bg-muted/50'}`}>
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                        {(conv.customerName || '?')[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{conv.customerName || conv.phone || 'Bilinmeyen'}</span>
                                            {channelIcon(conv.channel)}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">{conv.phone} · {conv.messageCount || 0} mesaj</p>
                                    </div>
                                    <span className="text-xs text-muted-foreground flex-shrink-0">{formatTime(conv.lastMessage)}</span>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Messages */}
                {selectedConv && (
                    <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
                        <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                                {(selectedConv.customerName || '?')[0].toUpperCase()}
                            </div>
                            <div>
                                <p className="font-semibold text-sm">{selectedConv.customerName || 'Bilinmeyen'}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">{channelIcon(selectedConv.channel)} {selectedConv.phone}</p>
                            </div>
                        </div>
                        <div className="flex-1 px-5 py-4 overflow-y-auto max-h-[500px] space-y-3 bg-background/50">
                            {msgLoading ? (
                                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
                            ) : messages.length === 0 ? (
                                <p className="text-center text-muted-foreground py-10">Mesaj yok.</p>
                            ) : messages.map((msg, i) => (
                                <div key={msg.id || i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                                        ${msg.role === 'user' ? 'bg-muted border border-border' : 'bg-primary/10 border border-primary/20'}`}>
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1 text-right">
                                            {formatTime(msg.timestamp)}
                                            {msg.action && <span className="ml-1 text-green-500">• {msg.action}</span>}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { Building2, Users, DollarSign, Wifi, AlertCircle, TrendingUp, Activity } from 'lucide-react';
import { creatorApi } from '../services/creatorApi';

function MiniBar({ value, max, color = '#6366f1' }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'var(--bg-hover)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: '4px', background: color, transition: 'width 0.6s ease' }} />
        </div>
    );
}

export default function Dashboard() {
    const [stats, setStats] = useState({
        activeStudios: 0,
        suspendedStudios: 0,
        totalCustomers: 0,
        monthlyRevenue: 0,
        whatsappEnabled: 0
    });
    const [loading, setLoading] = useState(true);
    const [recentStudios, setRecentStudios] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadStats();
    }, []);

    async function loadStats() {
        try {
            const result = await creatorApi.getStudiosWithStats();
            const studios = result?.studios || [];

            let activeStudios = 0, suspendedStudios = 0;
            let totalCustomers = 0, monthlyRevenue = 0, whatsappEnabled = 0;

            studios.forEach(studio => {
                if (studio.isActive !== false) {
                    activeStudios++;
                } else {
                    suspendedStudios++;
                }
                totalCustomers += studio.stats?.totalCustomers || 0;
                monthlyRevenue += studio.stats?.monthlyRevenue || 0;
                if (studio.stats?.whatsappEnabled) whatsappEnabled++;
            });

            setStats({ activeStudios, suspendedStudios, totalCustomers, monthlyRevenue, whatsappEnabled });
            setRecentStudios(studios);
        } catch (err) {
            console.error('Load stats error:', err);
            setError(err.message || 'İstatistikler yüklenemedi');
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="loader">
                <div className="loader-spinner"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--danger)' }}>
                <AlertCircle size={40} style={{ marginBottom: '12px' }} />
                <p>{error}</p>
                <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => { setLoading(true); setError(null); loadStats(); }}>
                    Tekrar Dene
                </button>
            </div>
        );
    }

    const maxRevenue = Math.max(...recentStudios.map(s => s.stats?.monthlyRevenue || 0), 1);
    const maxArchive = Math.max(...recentStudios.map(s => s.stats?.archiveCount || 0), 1);

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Dashboard</h1>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon primary">
                        <Building2 />
                    </div>
                    <div className="stat-content">
                        <h3>{stats.activeStudios}</h3>
                        <p>Aktif Stüdyo</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon warning">
                        <AlertCircle />
                    </div>
                    <div className="stat-content">
                        <h3>{stats.suspendedStudios}</h3>
                        <p>Pasif Stüdyo</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon success">
                        <Users />
                    </div>
                    <div className="stat-content">
                        <h3>{stats.totalCustomers.toLocaleString('tr-TR')}</h3>
                        <p>Toplam Müşteri</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon primary">
                        <DollarSign />
                    </div>
                    <div className="stat-content">
                        <h3>₺{stats.monthlyRevenue.toLocaleString('tr-TR')}</h3>
                        <p>Bu Ay Gelir</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon success">
                        <Wifi />
                    </div>
                    <div className="stat-content">
                        <h3>{stats.whatsappEnabled}</h3>
                        <p>WhatsApp Aktif</p>
                    </div>
                </div>
            </div>

            {/* Two-column layout: Revenue Chart + Quick Glance */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginTop: '24px' }}>

                {/* Revenue by Studio - visual bar chart */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">
                            <TrendingUp size={20} /> Stüdyo Gelirleri
                        </h2>
                    </div>
                    {recentStudios.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                            Henüz stüdyo eklenmemiş.
                        </p>
                    ) : (
                        <div style={{ padding: '0 20px 20px' }}>
                            {recentStudios
                                .sort((a, b) => (b.stats?.monthlyRevenue || 0) - (a.stats?.monthlyRevenue || 0))
                                .map(studio => (
                                    <div key={studio.id} style={{ marginBottom: '14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                                            <span style={{ fontWeight: 500 }}>{studio.name || studio.info?.name || 'İsimsiz'}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>₺{(studio.stats?.monthlyRevenue || 0).toLocaleString('tr-TR')}</span>
                                        </div>
                                        <MiniBar value={studio.stats?.monthlyRevenue || 0} max={maxRevenue} color="#6366f1" />
                                    </div>
                                ))}
                        </div>
                    )}
                </div>

                {/* Quick Glance */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">
                            <Activity size={20} /> Hızlı Bakış
                        </h2>
                    </div>
                    <div style={{ padding: '0 20px 20px' }}>
                        {recentStudios
                            .sort((a, b) => (b.stats?.archiveCount || 0) - (a.stats?.archiveCount || 0))
                            .slice(0, 6)
                            .map(studio => (
                                <div key={studio.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                                    <div style={{
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        background: studio.isActive !== false ? '#22c55e' : '#ef4444',
                                        flexShrink: 0
                                    }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {studio.name || studio.info?.name || 'İsimsiz'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            {studio.stats?.archiveCount || 0} arşiv · {studio.stats?.appointmentCount || 0} randevu
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '11px', color: studio.isActive !== false ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
                                        {studio.isActive !== false ? 'Aktif' : 'Pasif'}
                                    </span>
                                </div>
                            ))}
                    </div>
                </div>
            </div>

            {/* Studio Performance Table */}
            <div className="card" style={{ marginTop: '24px' }}>
                <div className="card-header">
                    <h2 className="card-title">
                        <Building2 size={20} />
                        Stüdyo Performans Tablosu
                    </h2>
                </div>

                {recentStudios.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                        Henüz stüdyo eklenmemiş.
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                    <th style={{ textAlign: 'left', padding: '10px 16px' }}>Stüdyo</th>
                                    <th style={{ textAlign: 'right', padding: '10px 16px' }}>Arşiv</th>
                                    <th style={{ textAlign: 'right', padding: '10px 16px' }}>Randevu</th>
                                    <th style={{ textAlign: 'right', padding: '10px 16px' }}>Müşteri</th>
                                    <th style={{ textAlign: 'right', padding: '10px 16px' }}>Bu Ay Gelir</th>
                                    <th style={{ textAlign: 'right', padding: '10px 16px' }}>Aktif (gün)</th>
                                    <th style={{ textAlign: 'center', padding: '10px 16px' }}>WhatsApp</th>
                                    <th style={{ textAlign: 'center', padding: '10px 16px' }}>Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentStudios.map(studio => (
                                    <tr key={studio.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '10px 16px', fontWeight: 500 }}>
                                            {studio.name || studio.info?.name || 'İsimsiz'}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '10px 16px' }}>
                                            {studio.stats?.archiveCount ?? '-'}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '10px 16px' }}>
                                            {studio.stats?.appointmentCount ?? '-'}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '10px 16px' }}>
                                            {studio.stats?.totalCustomers ?? '-'}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '10px 16px' }}>
                                            ₺{(studio.stats?.monthlyRevenue || 0).toLocaleString('tr-TR')}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '10px 16px' }}>
                                            {studio.stats?.activeSince ?? '-'}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '10px 16px' }}>
                                            {studio.stats?.whatsappEnabled
                                                ? <span style={{ color: 'var(--success)' }}>✅</span>
                                                : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '10px 16px' }}>
                                            <span className={`studio-status ${studio.isActive !== false ? 'active' : 'inactive'}`}>
                                                {studio.isActive !== false ? 'Aktif' : 'Pasif'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

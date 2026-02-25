import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeLabels = {
    dashboard: 'Dashboard',
    archives: 'Arşiv',
    appointments: 'Randevular',
    shoots: 'Çekimler',
    customers: 'Müşteriler',
    finance: 'Finans',
    reports: 'Raporlar',
    'wc-clients': 'Online Satış',
    settings: 'Ayarlar',
    users: 'Kullanıcılar'
};

export default function Breadcrumb() {
    const location = useLocation();
    const segments = location.pathname.split('/').filter(Boolean);

    if (segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard')) {
        return null;
    }

    return (
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
            <Link to="/dashboard" className="hover:text-foreground transition-colors">
                <Home className="w-4 h-4" />
            </Link>
            {segments.map((seg, i) => {
                const path = '/' + segments.slice(0, i + 1).join('/');
                const label = routeLabels[seg] || decodeURIComponent(seg);
                const isLast = i === segments.length - 1;

                return (
                    <span key={path} className="flex items-center gap-1">
                        <ChevronRight className="w-3 h-3" />
                        {isLast ? (
                            <span className="text-foreground font-medium">{label}</span>
                        ) : (
                            <Link to={path} className="hover:text-foreground transition-colors">{label}</Link>
                        )}
                    </span>
                );
            })}
        </nav>
    );
}

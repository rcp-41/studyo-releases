import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Home } from 'lucide-react';

export default function Breadcrumb() {
    const { t } = useTranslation();
    const location = useLocation();
    const segments = location.pathname.split('/').filter(Boolean);

    if (segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard')) {
        return null;
    }

    const getLabel = (seg) => {
        // Map hyphens to camelCase for i18n keys (wc-clients -> wcClients)
        const key = seg.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        return t(`breadcrumb.${key}`, { defaultValue: decodeURIComponent(seg) });
    };

    return (
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
            <Link to="/dashboard" className="hover:text-foreground transition-colors">
                <Home className="w-4 h-4" />
            </Link>
            {segments.map((seg, i) => {
                const path = '/' + segments.slice(0, i + 1).join('/');
                const label = getLabel(seg);
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

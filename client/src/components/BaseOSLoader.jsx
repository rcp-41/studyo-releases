/**
 * BaseOSLoader — Animated mini BaseOS prism logo as a loading indicator.
 * Replaces the default Loader2 spinner throughout the app.
 */
export default function BaseOSLoader({ size = 48, className = '' }) {
    const s = size;
    const half = s / 2;

    return (
        <div className={className} style={{ width: s, height: s, position: 'relative' }}>
            <style>{`
                .baseos-loader-prism {
                    animation: baseos-loader-spin 3s linear infinite;
                    filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.4));
                }
                @keyframes baseos-loader-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .baseos-loader-pulse {
                    animation: baseos-loader-pulse 2s ease-in-out infinite;
                }
                @keyframes baseos-loader-pulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 1; }
                }
            `}</style>
            <svg
                viewBox="0 0 100 100"
                width={s}
                height={s}
                className="baseos-loader-pulse"
            >
                <defs>
                    <linearGradient id="loaderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.6" />
                    </linearGradient>
                </defs>
                {/* Prism */}
                <polygon
                    points="50,15 20,75 80,75"
                    fill="url(#loaderGrad)"
                    fillOpacity="0.2"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                />
                {/* Center glow */}
                <circle cx="50" cy="55" r="5" fill="rgba(56, 189, 248, 0.3)" />
            </svg>
            {/* Spinning orbit */}
            <svg
                viewBox="0 0 100 100"
                width={s}
                height={s}
                className="baseos-loader-prism"
                style={{ position: 'absolute', top: 0, left: 0 }}
            >
                <ellipse
                    cx="50" cy="50" rx="40" ry="16"
                    fill="none"
                    stroke="rgba(56, 189, 248, 0.25)"
                    strokeWidth="1"
                    strokeDasharray="4 8"
                />
            </svg>
        </div>
    );
}

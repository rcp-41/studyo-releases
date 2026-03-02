/**
 * SplashScreen — BaseOS animated splash with integrated update check.
 * Prism + orbital binary rings animation, "BaseOS" text, "by RaiKan" subtitle.
 * During animation: checks for updates. If update found → mandatory progress bar.
 */
import { useState, useEffect, useRef } from 'react';

export default function SplashScreen({ onComplete }) {
    const [phase, setPhase] = useState('animating'); // animating | updating | done
    const [updateProgress, setUpdateProgress] = useState(0);
    const [updateVersion, setUpdateVersion] = useState('');
    const [fadeOut, setFadeOut] = useState(false);
    const updateFoundRef = useRef(false);
    const minimumTimeRef = useRef(false);

    useEffect(() => {
        // Minimum splash display: 3.5s
        const minTimer = setTimeout(() => {
            minimumTimeRef.current = true;
            if (!updateFoundRef.current && phase === 'animating') {
                finishSplash();
            }
        }, 3500);

        // Listen for update events from Electron
        if (window.electron?.update) {
            const removeStatus = window.electron.update.onStatus?.((status, data) => {
                if (status === 'available' && data?.version) {
                    updateFoundRef.current = true;
                    setUpdateVersion(data.version);
                    setPhase('updating');
                }
                if (status === 'up-to-date' && minimumTimeRef.current) {
                    finishSplash();
                }
                if (status === 'downloaded') {
                    // Auto-install mandatory update
                    setTimeout(() => {
                        window.electron.update.install?.();
                    }, 1000);
                }
                if (status === 'error') {
                    // On error, proceed anyway after minimum time
                    if (minimumTimeRef.current) finishSplash();
                }
            });

            const removeProgress = window.electron.update.onProgress?.((pct) => {
                setUpdateProgress(pct);
            });

            // Trigger update check
            window.electron.update.check?.();

            return () => {
                clearTimeout(minTimer);
                removeStatus?.();
                removeProgress?.();
            };
        }

        return () => clearTimeout(minTimer);
    }, []);

    const finishSplash = () => {
        if (phase === 'updating') return; // Don't close if updating
        setFadeOut(true);
        setTimeout(() => onComplete?.(), 600);
    };

    return (
        <div className={`splash-root ${fadeOut ? 'splash-fade-out' : ''}`}>
            <style>{`
                .splash-root {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: #0a0e1a;
                    transition: opacity 0.6s ease;
                }
                .splash-fade-out { opacity: 0; pointer-events: none; }

                /* Prism container */
                .prism-container {
                    position: relative;
                    width: 200px;
                    height: 200px;
                    margin-bottom: 32px;
                }

                /* SVG Prism */
                .prism-shape {
                    animation: prism-appear 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    opacity: 0;
                    filter: drop-shadow(0 0 30px rgba(56, 189, 248, 0.4));
                }
                @keyframes prism-appear {
                    0% { opacity: 0; transform: scale(0.3) rotate(-15deg); }
                    100% { opacity: 1; transform: scale(1) rotate(0deg); }
                }

                /* Prism glow pulse */
                .prism-glow {
                    animation: glow-pulse 3s ease-in-out infinite;
                }
                @keyframes glow-pulse {
                    0%, 100% { filter: drop-shadow(0 0 20px rgba(56, 189, 248, 0.3)); }
                    50% { filter: drop-shadow(0 0 40px rgba(6, 182, 212, 0.6)); }
                }

                /* Orbital rings */
                .orbit-ring {
                    position: absolute;
                    top: 50%; left: 50%;
                    transform-origin: center;
                    border: 1.5px solid rgba(56, 189, 248, 0.15);
                    border-radius: 50%;
                    opacity: 0;
                    animation: orbit-appear 0.8s ease forwards;
                }
                .orbit-1 {
                    width: 240px; height: 100px;
                    margin-left: -120px; margin-top: -50px;
                    transform: rotateX(60deg) rotateZ(0deg);
                    animation-delay: 0.6s;
                    animation: orbit-appear 0.8s ease 0.6s forwards, orbit-spin-1 12s linear 1.4s infinite;
                }
                .orbit-2 {
                    width: 200px; height: 80px;
                    margin-left: -100px; margin-top: -40px;
                    transform: rotateX(70deg) rotateZ(60deg);
                    animation-delay: 0.9s;
                    animation: orbit-appear 0.8s ease 0.9s forwards, orbit-spin-2 15s linear 1.7s infinite;
                }
                .orbit-3 {
                    width: 260px; height: 110px;
                    margin-left: -130px; margin-top: -55px;
                    transform: rotateX(55deg) rotateZ(-30deg);
                    animation-delay: 1.2s;
                    animation: orbit-appear 0.8s ease 1.2s forwards, orbit-spin-3 18s linear 2s infinite;
                }
                @keyframes orbit-appear {
                    from { opacity: 0; } to { opacity: 1; }
                }
                @keyframes orbit-spin-1 { to { transform: rotateX(60deg) rotateZ(360deg); } }
                @keyframes orbit-spin-2 { to { transform: rotateX(70deg) rotateZ(420deg); } }
                @keyframes orbit-spin-3 { to { transform: rotateX(55deg) rotateZ(330deg); } }

                /* Binary digits */
                .binary-container {
                    position: absolute;
                    top: 50%; left: 50%;
                    width: 260px; height: 260px;
                    margin-left: -130px; margin-top: -130px;
                    pointer-events: none;
                }
                .binary-digit {
                    position: absolute;
                    font-family: 'Courier New', monospace;
                    font-size: 11px;
                    color: rgba(56, 189, 248, 0.6);
                    text-shadow: 0 0 8px rgba(56, 189, 248, 0.4);
                    opacity: 0;
                    animation: binary-float 4s ease-in-out infinite;
                }
                @keyframes binary-float {
                    0%, 100% { opacity: 0; transform: translateY(0); }
                    20% { opacity: 0.8; }
                    50% { opacity: 0.4; transform: translateY(-10px); }
                    80% { opacity: 0.7; }
                }

                /* BaseOS text */
                .splash-title {
                    font-family: 'Segoe UI', -apple-system, system-ui, sans-serif;
                    font-size: 48px;
                    font-weight: 800;
                    letter-spacing: 6px;
                    background: linear-gradient(135deg, #38bdf8, #06b6d4, #38bdf8);
                    background-size: 200% 100%;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    opacity: 0;
                    animation: title-appear 1s ease 1.5s forwards, title-shimmer 3s ease 2.5s infinite;
                    margin-bottom: 8px;
                }
                @keyframes title-appear {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes title-shimmer {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }

                /* by RaiKan */
                .splash-subtitle {
                    font-family: 'Segoe UI', -apple-system, system-ui, sans-serif;
                    font-size: 13px;
                    letter-spacing: 4px;
                    color: rgba(148, 163, 184, 0.6);
                    opacity: 0;
                    animation: sub-appear 0.8s ease 2.2s forwards;
                    text-transform: uppercase;
                }
                @keyframes sub-appear {
                    from { opacity: 0; } to { opacity: 1; }
                }

                /* Update section */
                .update-section {
                    margin-top: 40px;
                    text-align: center;
                    opacity: 0;
                    animation: sub-appear 0.5s ease forwards;
                }
                .update-label {
                    font-size: 13px;
                    color: rgba(148, 163, 184, 0.7);
                    margin-bottom: 12px;
                    font-family: 'Segoe UI', sans-serif;
                }
                .update-bar-bg {
                    width: 280px;
                    height: 4px;
                    background: rgba(56, 189, 248, 0.1);
                    border-radius: 4px;
                    overflow: hidden;
                    margin: 0 auto;
                }
                .update-bar-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #38bdf8, #06b6d4);
                    border-radius: 4px;
                    transition: width 0.4s ease;
                    box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);
                }
                .update-pct {
                    font-size: 12px;
                    color: rgba(56, 189, 248, 0.8);
                    margin-top: 8px;
                    font-family: 'Courier New', monospace;
                }

                /* Ambient particles */
                .ambient-particle {
                    position: fixed;
                    width: 2px; height: 2px;
                    background: rgba(56, 189, 248, 0.3);
                    border-radius: 50%;
                    animation: ambient-drift linear infinite;
                }
                @keyframes ambient-drift {
                    0% { transform: translateY(100vh) scale(0); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 0.3; }
                    100% { transform: translateY(-10vh) scale(1); opacity: 0; }
                }
            `}</style>

            {/* Ambient particles */}
            {Array.from({ length: 20 }).map((_, i) => (
                <div
                    key={i}
                    className="ambient-particle"
                    style={{
                        left: `${Math.random() * 100}%`,
                        animationDuration: `${4 + Math.random() * 6}s`,
                        animationDelay: `${Math.random() * 3}s`,
                        width: `${1 + Math.random() * 2}px`,
                        height: `${1 + Math.random() * 2}px`,
                    }}
                />
            ))}

            {/* Prism + Orbits */}
            <div className="prism-container">
                {/* Orbital rings */}
                <div className="orbit-ring orbit-1" />
                <div className="orbit-ring orbit-2" />
                <div className="orbit-ring orbit-3" />

                {/* Binary digits */}
                <div className="binary-container">
                    {['1', '0', '1', '1', '0', '0', '1', '0', '1', '0', '0', '1', '1', '0', '1', '0'].map((d, i) => (
                        <span
                            key={i}
                            className="binary-digit"
                            style={{
                                left: `${50 + 42 * Math.cos((i / 16) * Math.PI * 2)}%`,
                                top: `${50 + 42 * Math.sin((i / 16) * Math.PI * 2)}%`,
                                animationDelay: `${1.5 + i * 0.2}s`,
                            }}
                        >
                            {d}
                        </span>
                    ))}
                </div>

                {/* SVG Prism */}
                <svg
                    className="prism-shape prism-glow"
                    viewBox="0 0 200 200"
                    width="200"
                    height="200"
                    style={{ position: 'absolute', top: 0, left: 0 }}
                >
                    <defs>
                        <linearGradient id="prismGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.7" />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.5" />
                        </linearGradient>
                        <linearGradient id="prismEdge" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.3" />
                        </linearGradient>
                    </defs>
                    {/* Main prism face */}
                    <polygon
                        points="100,25 45,145 155,145"
                        fill="url(#prismGrad)"
                        fillOpacity="0.15"
                        stroke="url(#prismEdge)"
                        strokeWidth="1.5"
                    />
                    {/* Inner highlight */}
                    <polygon
                        points="100,50 65,130 135,130"
                        fill="none"
                        stroke="rgba(125, 211, 252, 0.15)"
                        strokeWidth="0.5"
                    />
                    {/* Light refraction line */}
                    <line x1="100" y1="45" x2="100" y2="125" stroke="rgba(56, 189, 248, 0.1)" strokeWidth="0.5" />
                    {/* Center glow */}
                    <circle cx="100" cy="95" r="15" fill="rgba(56, 189, 248, 0.08)" />
                    <circle cx="100" cy="95" r="5" fill="rgba(125, 211, 252, 0.2)" />
                </svg>
            </div>

            {/* Title */}
            <div className="splash-title">BaseOS</div>
            <div className="splash-subtitle">by RaiKan</div>

            {/* Update progress (shows only when update found) */}
            {phase === 'updating' && (
                <div className="update-section">
                    <div className="update-label">
                        Güncelleme indiriliyor — v{updateVersion}
                    </div>
                    <div className="update-bar-bg">
                        <div
                            className="update-bar-fill"
                            style={{ width: `${updateProgress}%` }}
                        />
                    </div>
                    <div className="update-pct">{updateProgress}%</div>
                </div>
            )}
        </div>
    );
}

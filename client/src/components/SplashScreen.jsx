/**
 * SplashScreen — Plays intro video with integrated update check.
 * During video playback: checks for updates. If update found → mandatory progress bar.
 */
import { useState, useEffect, useRef } from 'react';

export default function SplashScreen({ onComplete }) {
    const [phase, setPhase] = useState('animating'); // animating | updating | done
    const [updateProgress, setUpdateProgress] = useState(0);
    const [updateVersion, setUpdateVersion] = useState('');
    const [fadeOut, setFadeOut] = useState(false);
    const updateFoundRef = useRef(false);
    const videoEndedRef = useRef(false);

    useEffect(() => {
        // Listen for update events from Electron
        if (window.electron?.update) {
            const removeStatus = window.electron.update.onStatus?.((status, data) => {
                if (status === 'available' && data?.version) {
                    updateFoundRef.current = true;
                    setUpdateVersion(data.version);
                    setPhase('updating');
                }
                if (status === 'up-to-date' && videoEndedRef.current) {
                    finishSplash();
                }
                if (status === 'downloaded') {
                    // Auto-install mandatory update
                    setTimeout(() => {
                        window.electron.update.install?.();
                    }, 1000);
                }
                if (status === 'error') {
                    // On error, proceed anyway after video ends
                    if (videoEndedRef.current) finishSplash();
                }
            });

            const removeProgress = window.electron.update.onProgress?.((pct) => {
                setUpdateProgress(pct);
            });

            // Trigger update check
            window.electron.update.check?.();

            return () => {
                removeStatus?.();
                removeProgress?.();
            };
        }
    }, []);

    const handleVideoEnd = () => {
        videoEndedRef.current = true;
        // If no update was found, finish splash
        if (!updateFoundRef.current) {
            finishSplash();
        }
        // If updating, keep splash visible until update completes
    };

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
                    background: #000;
                    transition: opacity 0.6s ease;
                }
                .splash-fade-out { opacity: 0; pointer-events: none; }

                /* Video */
                .splash-video {
                    max-width: 60vw;
                    max-height: 60vh;
                    object-fit: contain;
                }

                /* Update section */
                .update-section {
                    position: absolute;
                    bottom: 60px;
                    left: 50%;
                    transform: translateX(-50%);
                    text-align: center;
                    opacity: 0;
                    animation: update-appear 0.5s ease forwards;
                }
                @keyframes update-appear {
                    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
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
            `}</style>

            {/* Intro Video */}
            <video
                className="splash-video"
                src="/splash-intro.mp4"
                autoPlay
                muted
                playsInline
                onEnded={handleVideoEnd}
            />

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

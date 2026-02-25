/**
 * SubscriptionGuard
 * Wraps the app to check subscription status on login.
 * If subscription is expired/suspended, shows a blocking screen.
 */
import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { ShieldAlert, Loader2, RefreshCcw } from 'lucide-react';

export default function SubscriptionGuard({ children, studioConfig }) {
    const [status, setStatus] = useState('checking'); // 'checking' | 'active' | 'expired' | 'suspended' | 'error'
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (studioConfig?.studioId) {
            checkSubscription();
        } else {
            setStatus('active'); // No config = skip check (handled by Setup)
        }
    }, [studioConfig?.studioId]);

    async function checkSubscription() {
        try {
            const checkSub = httpsCallable(functions, 'setup-checkSubscription');
            const result = await checkSub({
                organizationId: studioConfig.organizationId,
                studioId: studioConfig.studioId
            });

            const { subscriptionStatus, expiresAt } = result.data;

            if (subscriptionStatus === 'active') {
                setStatus('active');
            } else if (subscriptionStatus === 'expired') {
                setStatus('expired');
                setMessage(expiresAt
                    ? `Aboneliğiniz ${new Date(expiresAt).toLocaleDateString('tr-TR')} tarihinde sona erdi.`
                    : 'Aboneliğiniz sona erdi.');
            } else if (subscriptionStatus === 'suspended') {
                setStatus('suspended');
                setMessage('Hesabınız askıya alındı. Lütfen yöneticinizle iletişime geçin.');
            } else {
                setStatus('active'); // Unknown status = allow
            }
        } catch (error) {
            console.error('Subscription check error:', error);
            // On error, allow access (fail-open) to avoid blocking on network issues
            setStatus('active');
        }
    }

    if (status === 'checking') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Abonelik kontrol ediliyor...</p>
                </div>
            </div>
        );
    }

    if (status === 'expired' || status === 'suspended') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <div className="w-full max-w-md text-center">
                    <div className="bg-card border border-border rounded-2xl shadow-xl p-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 mb-6">
                            <ShieldAlert className="w-8 h-8 text-destructive" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">
                            {status === 'expired' ? 'Abonelik Süresi Doldu' : 'Hesap Askıda'}
                        </h2>
                        <p className="text-muted-foreground mb-6">{message}</p>
                        <button
                            onClick={() => { setStatus('checking'); checkSubscription(); }}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all inline-flex items-center gap-2"
                        >
                            <RefreshCcw className="w-4 h-4" />
                            Tekrar Kontrol Et
                        </button>
                        <p className="text-xs text-muted-foreground mt-4">
                            Stüdyo: {studioConfig?.studioName || studioConfig?.studioId}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return children;
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, CheckCircle2 } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import toast from 'react-hot-toast';

export default function Setup() {
    const [serialKey, setSerialKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [validatedStudio, setValidatedStudio] = useState(null);
    const navigate = useNavigate();

    // Auto-format serial key input: XXXX-XXXX-XXXX-XXXX
    const handleSerialKeyChange = (e) => {
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

        // Add dashes every 4 characters
        let formatted = '';
        for (let i = 0; i < value.length && i < 16; i++) {
            if (i > 0 && i % 4 === 0) formatted += '-';
            formatted += value[i];
        }

        setSerialKey(formatted);
        // Clear previous validation when key changes
        if (validatedStudio) setValidatedStudio(null);
    };

    const handleSetup = async (e) => {
        e.preventDefault();

        if (!serialKey || serialKey.length !== 19) {
            toast.error('Lütfen geçerli bir seri numarası girin (XXXX-XXXX-XXXX-XXXX)');
            return;
        }

        setIsLoading(true);

        try {
            // Call Cloud Function to validate serial key and get studioId
            const validateSerialKey = httpsCallable(functions, 'setup-validateSerialKey');
            const response = await validateSerialKey({ serialKey: serialKey.trim() });
            const { studioId, studioName } = response.data;

            // Save resolved studioId and studioName
            const config = {
                studioId,
                studioName,
                serialKey: serialKey.trim(),
                setupDate: new Date().toISOString()
            };

            let result;
            if (window.electron && window.electron.saveLicenseConfig) {
                result = await window.electron.saveLicenseConfig(config);
            } else {
                // Fallback for web/dev mode
                localStorage.setItem('studyo_license', JSON.stringify(config));
                result = { success: true };
            }

            if (result.success) {
                setValidatedStudio({ studioId, studioName });
                toast.success(`${studioName} stüdyosuna bağlanıldı!`);
                setTimeout(() => {
                    navigate('/login');
                }, 1500);
            } else {
                throw new Error(result.error || 'Kaydetme başarısız');
            }

        } catch (error) {
            console.error('Setup error:', error);

            // Handle specific Firebase errors
            const errorMessage = error.message || '';
            if (errorMessage.includes('not-found') || errorMessage.includes('No studio found')) {
                toast.error('Bu seri numarasına ait stüdyo bulunamadı');
            } else if (errorMessage.includes('invalid-argument') || errorMessage.includes('Invalid serial key')) {
                toast.error('Geçersiz seri numarası formatı');
            } else {
                toast.error('Doğrulama başarısız: ' + errorMessage);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
                        <KeyRound className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold">Stüdyo Aktivasyonu</h1>
                    <p className="text-muted-foreground mt-2">
                        Seri numaranızı girerek cihazı stüdyonuza bağlayın
                    </p>
                </div>

                {/* Setup Card */}
                <div className="bg-card border border-border rounded-2xl shadow-xl p-8">
                    <form onSubmit={handleSetup} className="space-y-5">
                        {/* Serial Key Input */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Seri Numarası
                            </label>
                            <input
                                type="text"
                                value={serialKey}
                                onChange={handleSerialKeyChange}
                                className="w-full px-4 py-3 rounded-lg bg-background border border-input focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-mono text-lg tracking-wider text-center"
                                placeholder="XXXX-XXXX-XXXX-XXXX"
                                disabled={isLoading}
                                maxLength={19}
                                autoFocus
                            />
                            <p className="text-xs text-muted-foreground mt-1.5">
                                Creator Panel'den aldığınız lisans anahtarını girin.
                            </p>
                        </div>

                        {/* Validated Studio Info */}
                        {validatedStudio && (
                            <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-green-500">Stüdyo Bulundu</p>
                                    <p className="text-sm">{validatedStudio.studioName}</p>
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || serialKey.length !== 19}
                            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 focus:ring-4 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-6"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Doğrulanıyor...
                                </>
                            ) : (
                                <>
                                    <KeyRound className="w-5 h-5" />
                                    Aktive Et
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-muted-foreground mt-6">
                    Seri numaranız yoksa stüdyo yöneticinizle iletişime geçin.
                </p>
            </div>
        </div>
    );
}

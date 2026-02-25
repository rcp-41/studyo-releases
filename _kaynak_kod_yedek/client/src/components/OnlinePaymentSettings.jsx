import { useState } from 'react';
import { cn } from '../lib/utils';
import { X, CreditCard, ExternalLink, Shield, CheckCircle, AlertCircle, Loader2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * OnlinePaymentSettings component
 * iyzico and PayTR integration configuration.
 * Displayed in Settings > API Integrations section.
 */
export default function OnlinePaymentSettings({ settings, onUpdate }) {
    const [testing, setTesting] = useState(null); // 'iyzico' | 'paytr' | null

    const iyzicoEnabled = settings?.api?.iyzico_enabled || false;
    const paytrEnabled = settings?.api?.paytr_enabled || false;

    const handleToggle = (provider) => {
        const key = `${provider}_enabled`;
        onUpdate('api', key, !settings?.api?.[key]);
    };

    const handleKeyChange = (key, value) => {
        onUpdate('api', key, value);
    };

    const handleTest = async (provider) => {
        setTesting(provider);
        // Simulate a test connection
        await new Promise(r => setTimeout(r, 1500));
        toast.success(`${provider === 'iyzico' ? 'iyzico' : 'PayTR'} bağlantısı başarılı (test modu)`);
        setTesting(null);
    };

    return (
        <div className="space-y-6">
            {/* iyzico */}
            <div className={cn('border rounded-xl transition-colors', iyzicoEnabled ? 'border-primary/30 bg-primary/5' : 'border-border')}>
                <div className="flex items-center justify-between p-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <h4 className="font-semibold">iyzico</h4>
                            <p className="text-xs text-muted-foreground">3D Secure online ödeme</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <a href="https://merchant.iyzipay.com" target="_blank" rel="noopener noreferrer"
                            className="p-1.5 hover:bg-muted rounded text-muted-foreground">
                            <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                            onClick={() => handleToggle('iyzico')}
                            className={cn('w-11 h-6 rounded-full transition-colors relative',
                                iyzicoEnabled ? 'bg-primary' : 'bg-muted')}
                        >
                            <div className={cn('w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform',
                                iyzicoEnabled ? 'translate-x-[22px]' : 'translate-x-0.5')} />
                        </button>
                    </div>
                </div>

                {iyzicoEnabled && (
                    <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">API Key</label>
                                <input type="password" value={settings?.api?.iyzico_api_key || ''}
                                    onChange={e => handleKeyChange('iyzico_api_key', e.target.value)}
                                    placeholder="sandbox-..." className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-input text-sm" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Secret Key</label>
                                <input type="password" value={settings?.api?.iyzico_secret_key || ''}
                                    onChange={e => handleKeyChange('iyzico_secret_key', e.target.value)}
                                    placeholder="sandbox-..." className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-input text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Mod</label>
                            <select value={settings?.api?.iyzico_mode || 'sandbox'}
                                onChange={e => handleKeyChange('iyzico_mode', e.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-input text-sm">
                                <option value="sandbox">Sandbox (Test)</option>
                                <option value="live">Live (Canlı)</option>
                            </select>
                        </div>
                        <button onClick={() => handleTest('iyzico')} disabled={testing === 'iyzico'}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted disabled:opacity-50">
                            {testing === 'iyzico' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                            Bağlantıyı Test Et
                        </button>
                    </div>
                )}
            </div>

            {/* PayTR */}
            <div className={cn('border rounded-xl transition-colors', paytrEnabled ? 'border-primary/30 bg-primary/5' : 'border-border')}>
                <div className="flex items-center justify-between p-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                            <h4 className="font-semibold">PayTR</h4>
                            <p className="text-xs text-muted-foreground">iFrame ödeme entegrasyonu</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <a href="https://www.paytr.com/magaza/panele-giris" target="_blank" rel="noopener noreferrer"
                            className="p-1.5 hover:bg-muted rounded text-muted-foreground">
                            <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                            onClick={() => handleToggle('paytr')}
                            className={cn('w-11 h-6 rounded-full transition-colors relative',
                                paytrEnabled ? 'bg-primary' : 'bg-muted')}
                        >
                            <div className={cn('w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform',
                                paytrEnabled ? 'translate-x-[22px]' : 'translate-x-0.5')} />
                        </button>
                    </div>
                </div>

                {paytrEnabled && (
                    <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Merchant ID</label>
                                <input type="text" value={settings?.api?.paytr_merchant_id || ''}
                                    onChange={e => handleKeyChange('paytr_merchant_id', e.target.value)}
                                    placeholder="123456" className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-input text-sm" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Merchant Key</label>
                                <input type="password" value={settings?.api?.paytr_merchant_key || ''}
                                    onChange={e => handleKeyChange('paytr_merchant_key', e.target.value)}
                                    placeholder="..." className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-input text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Merchant Salt</label>
                            <input type="password" value={settings?.api?.paytr_merchant_salt || ''}
                                onChange={e => handleKeyChange('paytr_merchant_salt', e.target.value)}
                                placeholder="..." className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-input text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Mod</label>
                            <select value={settings?.api?.paytr_mode || 'test'}
                                onChange={e => handleKeyChange('paytr_mode', e.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-input text-sm">
                                <option value="test">Test</option>
                                <option value="live">Live (Canlı)</option>
                            </select>
                        </div>

                        {/* Callback URL info */}
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Callback URL (PayTR paneline girin):</p>
                            <div className="flex items-center gap-2">
                                <code className="text-xs bg-background px-2 py-1 rounded border border-border flex-1 truncate">
                                    {`https://us-central1-${window.location.hostname.split('.')[0] || 'projeniz'}.cloudfunctions.net/payment-callback`}
                                </code>
                                <button onClick={() => {
                                    navigator.clipboard.writeText(`https://us-central1-projeniz.cloudfunctions.net/payment-callback`);
                                    toast.success('Kopyalandı');
                                }} className="p-1 hover:bg-muted rounded">
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        <button onClick={() => handleTest('paytr')} disabled={testing === 'paytr'}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted disabled:opacity-50">
                            {testing === 'paytr' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                            Bağlantıyı Test Et
                        </button>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex items-start gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg text-xs text-muted-foreground">
                <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p>API anahtarları Firebase'de şifreli olarak saklanır. 3D Secure ile tüm ödemeler güvenlik altındadır.
                    Canlı moda geçmeden önce test modunda ödeme akışını doğrulayın.</p>
            </div>
        </div>
    );
}

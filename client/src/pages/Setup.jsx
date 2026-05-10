import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, Loader2, CheckCircle2, Clock, XCircle, Monitor } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { toast } from 'sonner';

export default function Setup() {
    const { t } = useTranslation();
    const [serialKey, setSerialKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [validatedStudio, setValidatedStudio] = useState(null);
    const navigate = useNavigate();

    // Approval waiting state
    const [awaitingApproval, setAwaitingApproval] = useState(false);
    const [approvalStatus, setApprovalStatus] = useState(null); // 'pending' | 'approved' | 'rejected'
    const [pendingData, setPendingData] = useState(null); // { organizationId, studioId, studioName, hwid }
    const pollingRef = useRef(null);

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

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    // Start polling for approval status
    const startPolling = (data) => {
        if (pollingRef.current) clearInterval(pollingRef.current);

        const checkStatus = async () => {
            try {
                const checkHwidStatus = httpsCallable(functions, 'setup-checkHwidStatus');
                const result = await checkHwidStatus({
                    organizationId: data.organizationId,
                    studioId: data.studioId,
                    hwid: data.hwid
                });

                const status = result.data?.status;
                setApprovalStatus(status);

                if (status === 'approved') {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;

                    // Save config locally
                    const config = {
                        studioId: data.studioId,
                        studioName: data.studioName,
                        organizationId: data.organizationId,
                        serialKey: data.serialKey,
                        hwid: data.hwid,
                        setupDate: new Date().toISOString()
                    };

                    let saveResult;
                    if (window.electron && window.electron.saveLicenseConfig) {
                        saveResult = await window.electron.saveLicenseConfig(config);
                    } else {
                        localStorage.setItem('studyo_license', JSON.stringify(config));
                        saveResult = { success: true };
                    }

                    if (saveResult.success) {
                        toast.success(t('pages.setup.connectionSuccess', { studioName: data.studioName }));
                        setTimeout(() => { navigate('/login'); }, 1500);
                    }
                } else if (status === 'rejected') {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                    toast.error(t('pages.setup.approvalRejectionAdmin'));
                }
            } catch (error) {
                // Polling error — will retry on next interval
            }
        };

        // Check immediately, then every 5 seconds
        checkStatus();
        pollingRef.current = setInterval(checkStatus, 5000);
    };

    const handleSetup = async (e) => {
        e.preventDefault();

        if (!serialKey || serialKey.length !== 19) {
            toast.error(t('pages.setup.invalidSerialError'));
            return;
        }

        setIsLoading(true);

        try {
            // Step 1: Validate serial key
            const validateSerialKey = httpsCallable(functions, 'setup-validateSerialKey');
            const response = await validateSerialKey({ serialKey: serialKey.trim() });
            const { studioId, studioName, organizationId } = response.data;

            setValidatedStudio({ studioId, studioName });

            // Step 2: Get system info (HWID, MAC, IP, hostname)
            let sysInfo = { hwid: null, macAddress: null, hostname: 'Unknown', ipAddress: null, deviceInfo: {} };
            if (window.electron && window.electron.getSystemInfo) {
                sysInfo = await window.electron.getSystemInfo();
            }

            if (!sysInfo.hwid) {
                toast.error(t('pages.setup.hwError'));
                setIsLoading(false);
                return;
            }

            // Step 3: Request HWID approval (instead of auto-registering)
            const requestHwidApproval = httpsCallable(functions, 'setup-requestHwidApproval');
            const approvalResult = await requestHwidApproval({
                organizationId,
                studioId,
                licenseKey: serialKey.trim(),
                hwid: sysInfo.hwid,
                macAddress: sysInfo.macAddress,
                hostname: sysInfo.hostname,
                ipAddress: sysInfo.ipAddress,
                localIp: sysInfo.localIp || null,
                publicIp: sysInfo.publicIp || null,
                deviceInfo: sysInfo.deviceInfo
            });

            const status = approvalResult.data?.status;

            if (status === 'approved') {
                // Already approved (returning device) — save config directly
                const config = {
                    studioId, studioName, organizationId,
                    serialKey: serialKey.trim(),
                    hwid: sysInfo.hwid,
                    setupDate: new Date().toISOString()
                };

                let result;
                if (window.electron && window.electron.saveLicenseConfig) {
                    result = await window.electron.saveLicenseConfig(config);
                } else {
                    localStorage.setItem('studyo_license', JSON.stringify(config));
                    result = { success: true };
                }

                if (result.success) {
                    toast.success(t('pages.setup.connectionSuccess', { studioName }));
                    setTimeout(() => { navigate('/login'); }, 1500);
                }
            } else {
                // Pending — show waiting screen and start polling
                const data = {
                    organizationId, studioId, studioName,
                    serialKey: serialKey.trim(),
                    hwid: sysInfo.hwid
                };
                setPendingData(data);
                setApprovalStatus('pending');
                setAwaitingApproval(true);
                startPolling(data);
                toast(t('pages.setup.requestSent'), { icon: '📤' });
            }

        } catch (error) {
            const errorMessage = error.message || '';
            if (errorMessage.includes('not-found') || errorMessage.includes('No studio found')) {
                toast.error(t('pages.setup.noStudioFound'));
            } else if (errorMessage.includes('invalid-argument') || errorMessage.includes('Invalid serial key')) {
                toast.error(t('pages.setup.invalidSerialFormat'));
            } else if (errorMessage.includes('does not match')) {
                toast.error(t('pages.setup.licenseMismatch'));
            } else {
                toast.error(t('pages.setup.verificationFailed', { error: errorMessage }));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
        setAwaitingApproval(false);
        setApprovalStatus(null);
        setPendingData(null);
    };

    // Approval Waiting Screen
    if (awaitingApproval) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 mb-4">
                            {approvalStatus === 'rejected' ? (
                                <XCircle className="w-8 h-8 text-red-500" />
                            ) : approvalStatus === 'approved' ? (
                                <CheckCircle2 className="w-8 h-8 text-green-500" />
                            ) : (
                                <Clock className="w-8 h-8 text-amber-500 animate-pulse" />
                            )}
                        </div>
                        <h1 className="text-2xl font-bold">
                            {approvalStatus === 'rejected' ? t('pages.setup.approvalRejected') :
                                approvalStatus === 'approved' ? t('pages.setup.approvalApproved') :
                                    t('pages.setup.approvalWaiting')}
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            {approvalStatus === 'rejected' ?
                                t('pages.setup.approvalRejectedDesc') :
                                approvalStatus === 'approved' ?
                                    t('pages.setup.approvalApprovedDesc') :
                                    t('pages.setup.approvalPendingDesc')}
                        </p>
                    </div>

                    <div className="bg-card border border-border rounded-2xl shadow-xl p-6">
                        {/* Studio Info */}
                        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg mb-4">
                            <Monitor className="w-5 h-5 text-primary flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium">{validatedStudio?.studioName}</p>
                                <p className="text-xs text-muted-foreground">
                                    HWID: {pendingData?.hwid?.substring(0, 12)}...
                                </p>
                            </div>
                        </div>

                        {/* Status Animation */}
                        {approvalStatus === 'pending' && (
                            <div className="text-center py-6">
                                <div className="flex items-center justify-center gap-2 text-amber-500 mb-3">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="text-sm font-medium">{t('pages.setup.checking')}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {t('pages.setup.checkingHint')}
                                </p>
                            </div>
                        )}

                        {/* Rejected Message */}
                        {approvalStatus === 'rejected' && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                                <p className="text-sm text-red-500">
                                    {t('pages.setup.rejectionMsg')}
                                </p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        {(approvalStatus === 'pending' || approvalStatus === 'rejected') && (
                            <button
                                onClick={handleCancel}
                                className="w-full py-2.5 px-4 border border-border rounded-lg text-sm font-medium hover:bg-muted/50 transition-all mt-2"
                            >
                                {approvalStatus === 'rejected' ? t('pages.setup.backButton') : t('pages.setup.cancelButton')}
                            </button>
                        )}
                    </div>

                    <p className="text-center text-xs text-muted-foreground mt-4">
                        {t('pages.setup.approvalManualHint')}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
                        <KeyRound className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold">{t('pages.setup.activation')}</h1>
                    <p className="text-muted-foreground mt-2">
                        {t('pages.setup.activationDesc')}
                    </p>
                </div>

                {/* Setup Card */}
                <div className="bg-card border border-border rounded-2xl shadow-xl p-8">
                    <form onSubmit={handleSetup} className="space-y-5">
                        {/* Serial Key Input */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {t('pages.setup.serialNumber')}
                            </label>
                            <input
                                type="text"
                                value={serialKey}
                                onChange={handleSerialKeyChange}
                                className="w-full px-4 py-3 rounded-lg bg-background border border-input focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-mono text-lg tracking-wider text-center"
                                placeholder={t('pages.setup.serialNumberPlaceholder')}
                                disabled={isLoading}
                                maxLength={19}
                                autoFocus
                            />
                            <p className="text-xs text-muted-foreground mt-1.5">
                                {t('pages.setup.enterSerialHint')}
                            </p>
                        </div>

                        {/* Validated Studio Info */}
                        {validatedStudio && (
                            <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-green-500">{t('pages.setup.studioFound')}</p>
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
                                    {t('pages.setup.verifying')}
                                </>
                            ) : (
                                <>
                                    <KeyRound className="w-5 h-5" />
                                    {t('pages.setup.activate')}
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-muted-foreground mt-6">
                    {t('pages.setup.contactAdmin')}
                </p>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

/**
 * Returns the current creator's sub-role and a helper to check permissions.
 * Roles: super | support | finance | readonly
 * Default is 'super' (backwards compat for existing creator accounts with no creator_role claim).
 */

const ROLE_PERMISSIONS = {
    super: ['*'],
    support: ['searchUsers', 'sendPasswordReset', 'startImpersonation', 'endImpersonation', 'revokeUserSessions', 'getAuditLogs', 'grantAppCheckOverride', 'revokeAppCheckOverride', 'blockDevice', 'unblockDevice', 'getBuildHistory', 'listAnnouncements', 'createAnnouncement', 'deleteAnnouncement', 'broadcastMessage', 'updateIpWhitelist'],
    finance: ['updateSubscription', 'changeStudioPlan', 'createCoupon', 'listCoupons', 'redeemCoupon', 'setTrialSubscription'],
    readonly: []
};

export function useCreatorRole() {
    const [creatorRole, setCreatorRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const tokenResult = await user.getIdTokenResult();
                    setCreatorRole(tokenResult.claims.creator_role || 'super');
                } catch {
                    setCreatorRole('super');
                }
            } else {
                setCreatorRole(null);
            }
            setLoading(false);
        });
        return unsub;
    }, []);

    function can(action) {
        if (!creatorRole) return false;
        const perms = ROLE_PERMISSIONS[creatorRole] || [];
        return perms.includes('*') || perms.includes(action);
    }

    return { creatorRole, loading, can };
}

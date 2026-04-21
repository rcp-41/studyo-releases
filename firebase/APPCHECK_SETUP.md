# Firebase AppCheck Setup Runbook

Operational runbook for enabling Firebase AppCheck (reCAPTCHA v3) on the Studyo
multi-tenant SaaS. Follow top-to-bottom the first time, then jump to the
enforcement section once every client is stamping tokens.

AppCheck is already wired into the code, behind a feature flag. Nothing in this
runbook changes behavior until you (1) fill in `VITE_APPCHECK_SITE_KEY` and
(2) deploy functions with `APPCHECK_ENABLED=true`.

## 1. Register the Web App with reCAPTCHA v3

1. Go to Firebase Console -> App Check -> Apps -> Web.
2. Click "Register" on the existing web app and choose `reCAPTCHA v3`.
3. Firebase will offer to create a new reCAPTCHA v3 key or accept an existing
   one. Either works; creating a new one is usually cleaner.
4. Copy the **site key** (public) and the **secret key** (server-side, goes
   only into Firebase — never commit it).

If you create the key yourself instead, do it at
<https://www.google.com/recaptcha/admin> -> `+` -> "reCAPTCHA v3". Register the
site key at Firebase Console -> App Check -> Apps -> Web -> "Manage providers".

## 2. Put the site key in the client builds

Add to `client/.env` and `creator_control_panel/.env`:

```
VITE_APPCHECK_SITE_KEY=6Lxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Rebuild the Vite bundles. With the key present, `src/lib/firebase.js`
automatically calls `initializeAppCheck(...)` with `ReCaptchaV3Provider` and
`isTokenAutoRefreshEnabled: true`. Without it, AppCheck stays off — the whole
feature is gated by that single env var.

## 3. Register a debug token for local dev

Local Vite dev (`import.meta.env.DEV`) sets
`self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` before init. On first page load,
the browser devtools console prints a line like:

```
App Check debug token: 1a2b3c4d-5e6f-...
```

Copy that UUID, then: Firebase Console -> App Check -> Apps -> Web -> three-dot
menu -> "Manage debug tokens" -> "Add debug token". Name it
`dev-<yourhandle>` so you can rotate later.

Repeat per developer workstation. Debug tokens bypass reCAPTCHA but still flow
through AppCheck, so the backend treats them as valid.

## 4. Soft-launch: monitor traffic before enforcing

Deploy the client with the site key first. In Firebase Console -> App Check,
watch the "Requests" chart per service (Cloud Functions / Firestore /
Storage). You want to see near-100% "Verified" before flipping enforcement —
anything outside that is either an unmigrated client or a bot.

Leave it in monitoring mode for at least 24-48h across business days.

## 5. Flip to enforce mode

When the Verified ratio is healthy:

```bash
firebase functions:config:set appcheck.enforce=true
# or, equivalently, set the runtime env var
firebase functions:config:set env.APPCHECK_ENABLED=true
firebase deploy --only functions
```

The `APPCHECK_ENABLED=true` env is what the shared `functions/src/config.js`
reads. Every onCall function in
`data-management.js / appointments.js / customers.js / shoots.js /
archives.js / finance.js / dashboard.js / users.js / settings.js /
options.js / pixonai.js / woocommerce.js` picks it up via
`enforceAppCheck: APPCHECK_ENABLED`, so one deploy flips the entire API.

You can also enforce at the service level in Firebase Console -> App Check
-> Apps -> "Enforce" for Firestore and Storage. Do that separately so you
can roll back functions independently of storage.

## 6. Rollback

If callables start failing for real users:

```bash
firebase functions:config:unset env.APPCHECK_ENABLED
firebase deploy --only functions
```

Next cold start returns to permissive mode. Clients with AppCheck initialized
still send tokens; backend just stops checking them.

## 7. Rotating the site key

reCAPTCHA v3 keys don't expire, but if a key is compromised:

1. Create a new v3 key at <https://www.google.com/recaptcha/admin>.
2. Firebase Console -> App Check -> Apps -> Web -> "Manage providers" -> add
   the new provider alongside the old one.
3. Ship new client builds with the new `VITE_APPCHECK_SITE_KEY`.
4. After a few days of traffic on the new key, remove the old provider.

Never rotate the server-side secret without coordinating with the site key —
they're a pair.

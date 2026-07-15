# Entra ID SAML SSO — Readiness Guide

**TOR references:** 3.1.7 / 3.2.7 / 3.6.3 · **PRD:** SEC-004
**Status:** External dependency — blocked on PCSO IT providing an Entra ID
enterprise application. Everything on the Supabase/app side is documented here
so configuration is a same-day task once PCSO IT engages.

## 1. Prerequisites

| Item                                                           | Owner              | Notes                                                                                                              |
| -------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Supabase **Pro plan or above** with SAML SSO enabled           | Th/rd Code / Infra | SAML is a paid-tier feature; request enablement via dashboard → Authentication → Sign In / Up → SSO if not visible |
| Entra ID tenant + permission to create Enterprise Applications | PCSO IT            | Global Admin or Application Admin role                                                                             |
| Agreed sign-in domain(s), e.g. `pcso.gov.ph`                   | PCSO IT + HRD      | Drives the domain-based `signInWithSSO` flow                                                                       |
| Supabase CLI ≥ 1.150 logged in with project access             | Th/rd Code         | `supabase login`                                                                                                   |

## 2. Supabase-side setup (exact steps)

Two equivalent paths — CLI (repeatable, preferred) or dashboard.

### 2.1 CLI

```bash
# Add the Entra ID SAML provider (metadata URL comes from PCSO IT, step 3)
supabase sso add \
  --project-ref <PROJECT_REF> \
  --type saml \
  --metadata-url 'https://login.microsoftonline.com/<TENANT_ID>/federationmetadata/2007-06/federationmetadata.xml?appid=<APP_ID>' \
  --domains pcso.gov.ph \
  --attribute-mapping-file ./supabase/sso/entra-attribute-mapping.json

# Inspect / list / update later
supabase sso list --project-ref <PROJECT_REF>
supabase sso show <PROVIDER_ID> --project-ref <PROJECT_REF>
supabase sso update <PROVIDER_ID> --project-ref <PROJECT_REF> --domains pcso.gov.ph,branch.pcso.gov.ph
```

`supabase/sso/entra-attribute-mapping.json` (create when configuring — the
email claim is the only REQUIRED mapping):

```json
{
  "keys": {
    "email": {
      "name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
    },
    "user_name": {
      "name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
    }
  }
}
```

### 2.2 Dashboard

Supabase Dashboard → **Authentication → Sign In / Up → SSO (SAML 2.0)** →
_Add provider_ → paste the same metadata URL, domains, and attribute mapping.

### 2.3 Values the Supabase side EXPOSES (give these to PCSO IT)

| SAML field             | Value                                                                       |
| ---------------------- | --------------------------------------------------------------------------- |
| Entity ID / Identifier | `https://<PROJECT_REF>.supabase.co/auth/v1/sso/saml/metadata`               |
| ACS URL (Reply URL)    | `https://<PROJECT_REF>.supabase.co/auth/v1/sso/saml/acs`                    |
| SP metadata download   | `https://<PROJECT_REF>.supabase.co/auth/v1/sso/saml/metadata?download=true` |

If a custom auth domain is configured, substitute it for
`<PROJECT_REF>.supabase.co` consistently.

## 3. PCSO-side Entra ID enterprise app (what PCSO IT must create)

1. Entra admin center → **Enterprise applications → New application →
   Create your own application** → "Integrate any other application you don't
   find in the gallery (Non-gallery)". Name: `PCSO HRIS (Supabase SSO)`.
2. **Single sign-on → SAML**, Basic SAML Configuration:
   - Identifier (Entity ID): the Entity ID from §2.3
   - Reply URL (ACS URL): the ACS URL from §2.3
3. **Attributes & Claims** — defaults are fine; confirm the email claim
   `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` maps
   to `user.mail` (fall back to `user.userprincipalname` only if `mail` is
   unpopulated — it must contain the address HRIS knows the employee by).
4. Copy the **App Federation Metadata Url** from the "SAML Certificates"
   card — this is the `--metadata-url` used in §2.1.
5. **Users and groups**: assign the pilot group first (IT-MIS + HRD), then
   staged rollout to all employees.
6. Conditional Access/MFA policy: PCSO IT applies its standard policy — MFA
   for SSO users is enforced at Entra, complementing the app's TOTP MFA for
   password-auth admins (SEC-003).

## 4. Fallback password auth — coexistence rules

- SAML SSO and email/password coexist natively in Supabase Auth; enabling the
  provider changes nothing for existing password users.
- Accounts are keyed by email: an SSO login whose email matches an existing
  password user signs into a linked identity on the same user; brand-new SSO
  emails create a new `auth.users` row on first login.
- New SSO-provisioned users receive the default `employee_self_service` role;
  role elevation stays a Super Admin action in **Admin → Users** (RBAC is
  never derived from Entra group claims in this phase).
- Keep password auth enabled permanently for: break-glass Super Admin
  accounts, JO/COS personnel without Entra accounts (TOR fallback
  requirement), and local/dev environments.

## 5. Login-page flow (to be wired later — login page owned elsewhere)

Domain-based flow: user enters their work email → if the domain has a
registered SSO provider, redirect to Entra; otherwise show the password
field. TODO snippet for the login-page owner (do NOT ship from this doc):

```ts
// TODO(login-page): SEC-004 — domain-based SSO sign-in
// supabase-js v2; place behind a "Sign in with PCSO account" button or an
// email-domain sniff on the email input's blur event.
const { data, error } = await supabase.auth.signInWithSSO({
  domain: "pcso.gov.ph",
  options: { redirectTo: `${window.location.origin}/auth/callback` },
});
if (data?.url) {
  window.location.href = data.url; // hand off to Entra ID
}
```

Notes for that wiring:

- The existing `/auth/callback` route already completes the session exchange;
  SSO logins land there like OAuth logins.
- Hide the SSO button when `signInWithSSO` returns "No SSO provider assigned
  for this domain" (pre-launch state) — feature-flag via org profile or env.
- N-036 (new-device SSO login notification) triggers off the standard
  Supabase auth event stream; no extra login-page work.

## 6. Verification checklist (acceptance evidence for TOR 3.6.3)

- [ ] `supabase sso list` shows the provider with the `pcso.gov.ph` domain
- [ ] Test user in the pilot Entra group completes: login page → Entra
      credentials (+ MFA) → lands on role dashboard
- [ ] Same email logging in with password (pre-existing account) still works
- [ ] New SSO user auto-provisioned with `employee_self_service` role and
      visible in Admin → Users
- [ ] Audit log records the sign-in; N-036 email observed on a new device
- [ ] Screen recording captured for the UAT evidence pack

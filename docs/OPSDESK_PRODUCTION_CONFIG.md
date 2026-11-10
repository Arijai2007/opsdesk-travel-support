# Production startup checks

Run the backend with `NODE_ENV=production` in a real production deployment. The ConfigModule validator checks the loaded environment before database/Redis providers are initialized. Missing NODE_ENV continues to mean development; do not depend on deployment infrastructure to infer this value.

Production startup rejects:

- `OPSDESK_DEMO=true` and `OPSDESK_LOCAL_COUNTERS=true` (including case/whitespace variations).
- Missing JWT secrets, secrets shorter than 32 characters, common placeholder values, or identical access/refresh secrets.
- A FRONTEND_URL that is not an exact HTTPS origin. Use `https://support.your-domain.com`, without a trailing slash, path, query, fragment or embedded credentials; CORS must match the browser's origin.
- Missing or invalid PostgreSQL/Redis connection URLs. Private-network Redis and TLS Redis schemes are both supported; select encryption/network controls for the actual environment.
- Missing Turnstile secret or known development placeholder/test keys.
- Mistyped NODE_ENV values rather than silently treating them as development.

Errors identify setting names rather than echoing values. The checks do not contact a provider, prove secret entropy, verify external credentials, configure TLS, provision accounts or certify a deployment. They are configuration sanity checks. Generate separate cryptographic signing secrets through your secret-management process; a long repeated string satisfies a length check but is not an acceptable secret.

Local `ops:preview` uses development backend configuration and remains supported. The separate optimized frontend build uses Next's production build mode; that does not turn the backend into a configured production service. Existing deployment documentation from the reference project is not an OpsDesk production runbook.

Before live use also remove or migrate synthetic accounts/data, configure real account/membership provisioning and retention, review proxy/CORS/cookies, select a deployment target, configure managed PostgreSQL/Redis, backups and monitoring, and rehearse staging recovery. This PR does not deploy or rotate any credential.

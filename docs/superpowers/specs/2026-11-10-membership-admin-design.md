# Audited membership administration

The user has directed us to build remaining features before deployment, with implementation choices delegated. This increment completes local invitation-based provisioning and reversible membership suspension. It does not deploy or configure live email.

## Approach and boundaries

Keep the existing five travel roles and server-side scopes. Managers provision new accounts with 24-hour, 32-byte random invitations, distributed manually as fragment links (`/activate#token=...`). Store only SHA-256 token hashes. Never expose passwords or invitation hashes in directory/audit responses. Reissuing revokes earlier invitations. Acceptance is single-use under a transaction, validates existing strong-password rules, sets the password and activates membership. It does not automatically sign in.

Direct manager-set passwords were rejected because managers should not know member passwords. Email-based delivery is deferred to the email feature; manual invitations make this feature usable locally now.

Membership has `INVITED`, `ACTIVE`, or `SUSPENDED` status plus an integer session version. Existing profiles migrate to ACTIVE/version 0. Login, refresh and JWT validation reject inactive memberships. JWT validation compares the live session version; suspension increments it and revokes refresh rows, preventing old sessions from returning after reactivation. Existing unversioned tokens count as version 0 for migration compatibility.

Only an active manager may invite, reissue, suspend, reactivate, create agencies/suppliers or read the complete membership directory and audit. Serialize these changes using the existing capacity advisory lock 804204, checking actor and target state again inside the transaction. Never suspend oneself or the last active manager. Direct activation of INVITED members is prohibited; they must accept an invitation. Reissuing for a non-active member returns it to INVITED and invalidates existing sessions. Active members cannot be re-invited through this flow.

Identity scopes are immutable in this increment: no role, agency, supplier or region edits after invitation. This prevents retroactive movement of historical records across access boundaries. New agency/supplier records can be created; no record deletion or scope reassignment is introduced. Suspension retains all cases, messages and ownership. Suspended agents receive no new automatic or manual assignments; existing ownership remains visible for manager reassignment.

## API contract

- `GET /ops/admin/members?page=1&search=&kind=`: manager-only; existing 20-row page envelope `{items,page,pageSize,total,totalPages}`. Item `{id,name,email,kind,status,agencyId,supplierId,region,available}`. Stable name/ID ordering; bounded search.
- `POST /ops/admin/invitations`: `{email,firstName,lastName,kind,agencyId?,supplierId?,region?,reason}` returns 201 `{member,token,expiresAt}`. CUSTOMER/AGENCY require an existing agency and forbid supplier/region; SUPPLIER requires an existing supplier and forbids agency/region; AGENT requires ASIA/EUROPE/AMERICAS/GLOBAL region and forbids agency/supplier; MANAGER uses GLOBAL and forbids agency/supplier. Reject existing email rather than taking over generic accounts.
- `POST /ops/admin/members/:id/invitation`: `{reason}` returns 201 `{member,token,expiresAt}`; only non-active members.
- `PATCH /ops/admin/members/:id/status`: `{status:'ACTIVE'|'SUSPENDED',reason}` returns `{member}`. A same-state retry returns unchanged without a second audit event. Reject INVITED direct activation and manager self-suspension.
- `POST /ops/admin/agencies`: `{name,code,reason}` returns 201 created agency. Normalize code uppercase, reject duplicate code. IDs generated server-side.
- `POST /ops/admin/suppliers`: `{name,email,reason}` returns 201 created supplier. IDs generated server-side.
- `GET /ops/admin/audit?page=1`: manager-only page envelope. Item `{id,actorId,entityId,action,reason,createdAt}`; no credentials or token material.
- `POST /ops/invitations/accept`: public, `{token,password}` returns 200 `{accepted:true}`. Token is 64 lowercase hex characters; expired/revoked/used tokens return the same generic 400. Check token existence before expensive password hashing; recheck under transaction. Apply a bounded per-IP attempt rate limit. Never log payload/token.

Names/email/password use existing registration validation conventions; reason is required, trimmed, 3–500 characters. Email is lowercase and trimmed. Business strings are bounded; reject unknown DTO properties. No change to public registration's inability to obtain a travel profile.

## UI

Add a manager-only Membership administration panel to the existing manager view. Show search/pagination, scope and status, invitation form, one-time link display with expiry, reissue for non-active members, and suspension/reactivation with a reason. Add agency/supplier creation forms and paged audit. Use existing visual components and accessible labels/status/errors. Never render admin data for another role.

Activation is a public `/activate` screen reading the token from the fragment, clearing it from the URL after capture, accepting a strong password, and calling a dedicated public Next server route `/api/invitations/accept`. That route forwards only token/password to the API, never arbitrary cookies or auth. After activation, show sign-in action; no token-bearing URL or password in success copy.

## Proof

Use real isolated PostgreSQL HTTP tests for five-role admin denial, input validation, full invitation/activation/login flow, expiry/reissue/single-use concurrency, session invalidation, stale tokens after reactivation, self/last-manager safeguards, assignment exclusion and unchanged historical records. Browser coverage must use manager controls and the fragment activation screen, and confirm non-manager invisibility and keyboard access. Run existing unit, HTTP, concurrency, Chromium and Firefox suites. Preserve production guards and synthetic-only test boundaries.

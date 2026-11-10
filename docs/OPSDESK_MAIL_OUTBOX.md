# Synthetic mail outbox

In the seeded demo and for explicitly allowlisted Resend pilot recipients, approved staff replies to customers and staff messages to a linked supplier create mail jobs in the same PostgreSQL transaction as the message. Customer and supplier replies, original intake text, and internal notes never enter the outbox. The job stores a message reference and expected recipient, while the manager list exposes case references, job status and attempt history.

Delivery starts paused. Keep `OPSDESK_MAIL_SYNTHETIC` unset for the standard smoke suites. To exercise the worker separately, set it to `true` and restart the isolated preview. The worker also requires `OPSDESK_DEMO=true` and a non-production backend. It uses an in-process synthetic transport with no network client. A simulated result does not mean anyone received an email.

The worker leases eligible jobs, records attempts and retries transient failures with exponential backoff. It rechecks sender role, membership, booking/supplier scope and the expected recipient before calling the transport. A changed or inactive recipient blocks delivery. A lease token fences completion so a worker that loses its lease cannot overwrite the new attempt. The job ID is the transport idempotency key. The Resend pilot uses this key within a conservative retry window.

Managers can open **Mail outbox** in the workspace to refresh the latest jobs, cancel queued or failed jobs, and retry failed jobs. The API also enforces active manager access. A retry resets the retry counter while preserving earlier attempts. Processing jobs cannot be cancelled through this control.

The standard `npm run ops:test` and `npm run ops:test:browser` commands include outbox coverage. Use the isolated seeded preview. Deployment remains paused.

## Resend pilot

The adapter is disabled by default. For a future isolated pilot, provision a verified sender and a dedicated Resend account or project. Set `OPSDESK_DEMO=false`, `OPSDESK_MAIL_RESEND=true`, `RESEND_API_KEY`, `OPSDESK_MAIL_FROM` (one mailbox), and `OPSDESK_MAIL_ALLOWLIST` (comma-separated exact recipient mailboxes). Demo and supplier fixture domains are rejected. Only new staff replies to currently eligible, allowlisted recipients are queued for Resend. Existing synthetic jobs retain their original transport. Keep these settings and the provider account stable while live jobs are pending. Never put these values in the repository.

Resend receives a fixed subject and the staff reply as plaintext. The sender and recipient eligibility checks run again before sending. API acceptance records a provider ID and appears as **Provider accepted**. A delivered receipt means the receiving mail server accepted the email. Retries reuse the same job ID and stop at 23 hours from job creation, within [Resend's 24-hour idempotency window](https://resend.com/docs/api-reference/emails/send-email#header-idempotency-key). Jobs beyond that window require manual reconciliation in the provider before any new reply is sent.

To collect delivery receipts, configure a distinct `RESEND_WEBHOOK_SECRET` and subscribe directly to the backend's `POST /ops/mail/webhooks/resend` for sent, delivered, delayed, bounced and failed events. Signature verification uses the original request bytes and Svix timestamps. Events are deduplicated by signed event ID and ordered by provider event time. Only IDs, kind and timestamps are retained. A receipt is visible on a manager's job when its provider ID matches the accepted send. See [Resend webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests) and [event types](https://resend.com/docs/webhooks/event-types).

Provider account setup, credentialed send and receipt acceptance, and secure attachments are pending. A valid Resend webhook signature authenticates the provider's event. Reply ingestion also needs a separate policy for authenticating and scoping the original email sender.
## Customer replies

Customer email replies are off by default and require the Resend pilot to issue new customer messages. Configure a dedicated verified receiving domain in Resend and set `OPSDESK_MAIL_REPLIES=true`, `OPSDESK_MAIL_REPLY_DOMAIN`, a random 32-byte hex `OPSDESK_MAIL_REPLY_SECRET`, and `RESEND_RECEIVING_API_KEY` with access to retrieve received mail. Add `email.received` to the existing signed webhook subscription. Keep the reply domain and secret stable while queued messages and their reply addresses are active. Rotating the secret revokes previously issued addresses.

The adapter issues a private, per-job Reply-To address only for new allowlisted customer messages. It expires seven days from job creation. The signed event must carry exactly one matching receiving address. OpsDesk checks the sending mailbox against the original job and the current active customer in the same agency. The case must remain open and the outbound job must have been accepted by the provider. The private address is a bearer capability and should be kept confidential. The webhook signature proves the provider delivered the event. It does not independently authenticate an SMTP From header.

Only bounded plaintext is imported into the existing customer thread. HTML, attachments and unrelated mail are ignored. The provider email ID is recorded separately from visible messages. Duplicate events, including events with different webhook IDs, cannot create a second message or trigger outbound email. Supplier mailboxes use the separately enabled path below. Staff notes stay outside email.

Run `node scripts/resend-inbound-smoke.mjs` against the built, migrated and seeded isolated demo. The standard API command includes this fixture-only check. A credentialed receiving-domain and mail client rehearsal is still required before enabling the pilot.
## Supplier replies

Set `OPSDESK_MAIL_SUPPLIER_REPLIES=true` in addition to the reply settings to issue private Reply-To addresses on new supplier emails. The outbound mailbox must also be the exact email address of an active supplier account. A shared address with no matching active account can still receive outbound mail under the pilot but cannot reply into OpsDesk.

OpsDesk rechecks the current supplier mailbox, the active account, the booking-to-supplier link and the open private conversation before writing a reply. A successful reply uses the portal's existing supplier transition and audit logic, preserves the saved supplier deadline, and creates no outbound email job. If other threads still await replies, the case keeps its supplier-wait status. Supplier messages stay private to their existing thread. The standard fixture suite uses mocked provider retrieval and checks rejection, deduplication, visibility, deadline preservation and the audit event.
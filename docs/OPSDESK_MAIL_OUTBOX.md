# Synthetic mail outbox

In the seeded demo, approved staff replies to customers and staff messages to a linked supplier create mail jobs in the same PostgreSQL transaction as the message. Customer and supplier replies, original intake text, and internal notes never enter the outbox. The job stores a message reference and expected recipient, while the manager list exposes case references, job status and attempt history.

Delivery starts paused. Keep `OPSDESK_MAIL_SYNTHETIC` unset for the standard smoke suites. To exercise the worker separately, set it to `true` and restart the isolated preview. The worker also requires `OPSDESK_DEMO=true` and a non-production backend. It uses an in-process synthetic transport with no network client. A simulated result does not mean anyone received an email.

The worker leases eligible jobs, records attempts and retries transient failures with exponential backoff. It rechecks sender role, membership, booking/supplier scope and the expected recipient before calling the transport. A changed or inactive recipient blocks delivery. A lease token fences completion so a worker that loses its lease cannot overwrite the new attempt. The job ID is the transport idempotency key. A future provider must enforce that key or reconcile provider delivery after an uncertain outcome.

Managers can open **Mail outbox** in the workspace to refresh the latest jobs, cancel queued or failed jobs, and retry failed jobs. The API also enforces active manager access. A retry resets the retry counter while preserving earlier attempts. Processing jobs cannot be cancelled through this control.

The standard `npm run ops:test` and `npm run ops:test:browser` commands include outbox coverage. Use the isolated seeded preview. Live provider delivery, verified sender provisioning, signed inbound webhooks and attachments remain open. Deployment remains paused.

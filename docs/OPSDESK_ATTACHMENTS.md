# Secure message attachments

Attachments belong to an existing OpsDesk message. The server checks the current active profile and the message's customer, staff, or supplier thread scope on every list, upload, link, and download request. A signed link lasts five minutes, is bound to the requesting user, and still requires JWT authentication and current thread access. Downloads are forced as attachments with `no-store` and `nosniff` headers.

The JSON upload endpoint is `POST /ops/messages/:messageId/attachments` with `filename`, `mimeType`, and `base64`. The maximum decoded size is 2 MiB. Only PDF, PNG, JPEG, and UTF-8 plain text are accepted; the declared type must match inspected content. The upload is scanned before persistence. Outside the isolated nonproduction synthetic preview, `OPSDESK_CLAMD_HOST` (and optional port, default 3310) must point to a ClamAV daemon supporting `INSTREAM`. Scanner failure or an inconclusive verdict rejects the upload. When `OPSDESK_CLAMD_HOST` is configured, the preview also uses ClamAV. The preview fixture without a configured host only rejects the EICAR test string and is suitable for synthetic data.

List with `GET /ops/messages/:messageId/attachments`. Request a link with `POST /ops/attachments/:id/download-link`, then GET its returned URL with the same authenticated user. Set `OPSDESK_ATTACHMENT_SIGNING_SECRET` to an independent random secret of at least 32 characters. A production deployment must configure the scanner and secret before enabling uploads.

The database stores file bytes and metadata. Rows expire 30 days after upload; an hourly cleanup removes expired rows and downloads reject them immediately. Backups can retain copies beyond this window, so live-data retention and backup deletion need an owner-approved policy. Incoming email attachments are still ignored. Attachment bytes are not included in outbound email, and attachments cannot be added to an unsent message atomically. Message threads include file lists, author-only upload controls and authenticated downloads. Up to five attachments are allowed per message, with concurrent uploads serialized and successful uploads audited. Mail composition integration remains open. The isolated preview generates a temporary signing key when none is configured; restarting it invalidates previous links.

## Verify ClamAV against the local preview

Run a local daemon with an initialized signature database and bind it to loopback. Set its stream limit to at least 2 MiB. For the official portable Windows package, verify the release checksum before extracting and configure the daemon using its sample configuration. [ClamAV Windows setup](https://docs.clamav.net/manual/Usage/Configuration.html#windows)

In the shell that starts the isolated preview, set the daemon's address and port.

```powershell
$env:OPSDESK_CLAMD_HOST = '127.0.0.1'
$env:OPSDESK_CLAMD_PORT = '13310'
npm run ops:preview
```

From a second shell, run `node scripts/attachments-smoke.mjs --clamav`. It sends clean text and the standard harmless EICAR sample over the API. Confirm the daemon reports a detection and the script passes the byte round-trip, access and attachment-limit checks. Then stop the daemon while the API stays running and run `node scripts/attachments-smoke.mjs --scanner-unavailable`. The upload must return HTTP 503 and the message's attachment list must stay empty. The standard attachment command uses the synthetic fixture when the preview starts without a configured host.

The Windows rehearsal used ClamAV 1.5.4 with a private database containing a single EICAR test signature. This exercises the real scanner protocol and upload outcomes. Official signature updates, deployment scanner operations and retention acceptance are still pending. [Signature format](https://docs.clamav.net/manual/Signatures/ExtendedSignatures.html)

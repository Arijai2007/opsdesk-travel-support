import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import pg from "pg";
const env = dotenv.parse(
  readFileSync(new URL("../backend/.env", import.meta.url)),
);
const base = process.env.OPSDESK_TEST_URL || "http://127.0.0.1:3001";
assert.equal(
  env.OPSDESK_DEMO,
  "true",
  "Run against an isolated synthetic preview",
);
assert.equal(new URL(env.DATABASE_URL).hostname, "127.0.0.1");
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const scannerUnavailable = process.argv.includes("--scanner-unavailable");
const realScanner = process.argv.includes("--clamav");
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const messageId = randomUUID();
let checks = 0;
async function call(path, token, body, expected = 200) {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const d = await r.json();
  assert.equal(r.status, expected, `${path}: ${JSON.stringify(d)}`);
  checks++;
  return d;
}
try {
  const session = await call("/auth/login", null, {
    email: "manager@opsdesk.demo",
    password: "OpsDeskDemo!2026",
  });
  const token = session.accessToken;
  const {
    rows: [manager],
  } = await pool.query(
    `SELECT id FROM "User" WHERE email='manager@opsdesk.demo'`,
  );
  const {
    rows: [ticket],
  } = await pool.query(`SELECT id FROM "TravelTicket" LIMIT 1`);
  await pool.query(
    `INSERT INTO "TravelMessage" (id,"ticketId","senderId",visibility,content) VALUES ($1,$2,$3,'INTERNAL','Attachment verification fixture')`,
    [messageId, ticket.id, manager.id],
  );
  const path = `/ops/messages/${messageId}/attachments`;
  const bytes = Buffer.from("Attachment round trip — synthetic fixture");
  const body = {
    filename: "receipt.txt",
    mimeType: "text/plain",
    base64: bytes.toString("base64"),
  };
  if (scannerUnavailable) {
    const result = await call(path, token, body, 503);
    assert.equal(result.message, "Attachment scanner unavailable.");
    assert.deepEqual(await call(path, token), []);
    console.log(
      "Attachment scanner outage passed: upload rejected and no file stored.",
    );
  } else {
    await call(path, null, undefined, 401);
    await call(path, token, { ...body, filename: "../escape.txt" }, 400);
    await call(path, token, { ...body, mimeType: "image/png" }, 400);
    await call(
      path,
      token,
      {
        ...body,
        base64: Buffer.from(
          realScanner
            ? "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
            : "EICAR-STANDARD-ANTIVIRUS-TEST-FILE",
        ).toString("base64"),
      },
      400,
    );
    const file = await call(path, token, body, 201);
    const list = await call(path, token);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, file.id);
    assert.equal(list[0].bytes, undefined);
    checks++;
    const supplier = await call("/auth/login", null, {
      email: "supplier@opsdesk.demo",
      password: "OpsDeskDemo!2026",
    });
    await call(path, supplier.accessToken, undefined, 404);
    await call(
      `/ops/attachments/${file.id}/download-link`,
      supplier.accessToken,
      {},
      404,
    );
    const link = await call(
      `/ops/attachments/${file.id}/download-link`,
      token,
      {},
      201,
    );
    const download = await fetch(base + link.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(download.status, 200);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
    checks++;
    assert.match(download.headers.get("content-disposition"), /^attachment;/);
    checks++;
    await call(
      link.url.replace(/signature=[^&]+/, "signature=" + "0".repeat(64)),
      token,
      undefined,
      403,
    );
    await pool.query(
      `UPDATE "TravelAttachment" SET "expiresAt"=$2 WHERE id=$1`,
      [file.id, new Date(Date.now() - 1000).toISOString()],
    );
    await call(link.url, token, undefined, 404);
    assert.equal((await call(path, token)).length, 0);
    checks++;
    await Promise.all(
      Array.from({ length: 4 }, () => call(path, token, body, 201)),
    );
    await call(path, token, body, 400);
    console.log(
      `Attachment smoke passed: ${checks} checks (${realScanner ? "ClamAV" : "synthetic"}).`,
    );
  }
} finally {
  await pool.query(
    `DELETE FROM "TravelEvent" WHERE "uniqueKey" IN (SELECT 'attachment:' || id FROM "TravelAttachment" WHERE "messageId"=$1)`,
    [messageId],
  );
  await pool.query(`DELETE FROM "TravelMessage" WHERE id=$1`, [messageId]);
  await pool.end();
}

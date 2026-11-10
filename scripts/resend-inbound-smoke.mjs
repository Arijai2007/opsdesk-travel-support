import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Webhook } from "standardwebhooks";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import { PrismaService } from "../backend/dist/prisma/prisma.service.js";
import { TravelService } from "../backend/dist/src/travel/travel.service.js";
import { TravelMailService } from "../backend/dist/src/travel/travel-mail.service.js";
import { SyntheticTravelMailTransport } from "../backend/dist/src/travel/travel-mail.transport.js";
import { ResendMailWebhookController } from "../backend/dist/src/travel/resend-mail-webhook.controller.js";
import {
  incomingConfig,
  replyAddress,
} from "../backend/dist/src/travel/resend-mail-reply.js";

Object.assign(
  process.env,
  dotenv.parse(readFileSync(new URL("../backend/.env", import.meta.url))),
);
assert.equal(new URL(process.env.DATABASE_URL).hostname, "127.0.0.1");
assert.equal(process.env.OPSDESK_DEMO, "true", "Use the isolated seeded demo.");
const secret = "whsec_" + Buffer.alloc(32, 9).toString("base64");
Object.assign(process.env, {
  OPSDESK_DEMO: "false",
  OPSDESK_MAIL_RESEND: "false",
  OPSDESK_MAIL_REPLIES: "true",
  OPSDESK_MAIL_REPLY_DOMAIN: "replies.example.com",
  OPSDESK_MAIL_REPLY_SECRET: "23".repeat(32),
  RESEND_RECEIVING_API_KEY: "fixture",
  RESEND_WEBHOOK_SECRET: secret,
});
const config = incomingConfig();
assert(config);

const db = new PrismaService();
const mail = new TravelMailService(db, new SyntheticTravelMailTransport());
const travel = new TravelService(db, mail);
const controller = new ResendMailWebhookController(db, travel);
const sourceMessages = [];
const receipts = [];
const marker = "Inbound fixture " + randomUUID();
const originalFetch = globalThis.fetch;
let ticket;
let supplierTicket;
let supplierMailbox;
let requests = 0;

try {
  const customer = await db.travelProfile.findFirstOrThrow({
    where: { kind: "CUSTOMER", status: "ACTIVE" },
    include: { user: true },
  });
  ticket = await db.travelTicket.findFirstOrThrow({
    where: {
      customerId: customer.userId,
      status: { notIn: ["CLOSED", "RESOLVED"] },
    },
  });
  const staff = await db.travelProfile.findFirstOrThrow({
    where: { kind: "MANAGER" },
  });

  async function createJob(recipient, age = 0, conversation) {
    const message = await db.travelMessage.create({
      data: {
        ticketId: conversation?.ticketId ?? ticket.id,
        conversationId: conversation?.id,
        senderId: staff.userId,
        visibility: conversation ? "SUPPLIER" : "CUSTOMER",
        content: "Fixture outbound",
      },
    });
    sourceMessages.push(message.id);
    return db.travelMailJob.create({
      data: {
        messageId: message.id,
        recipient,
        transport: "RESEND",
        status: "PROVIDER_ACCEPTED",
        replyEnabled: true,
        providerId: randomUUID(),
        createdAt: new Date(Date.now() - age),
      },
    });
  }

  globalThis.fetch = async (url) => {
    requests++;
    const match =
      /^https:\/\/api\.resend\.com\/emails\/receiving\/([0-9a-f-]{36})$/.exec(
        url,
      );
    assert(match, "Provider requests are mocked");
    return Response.json({
      id: match[1],
      text: marker,
      html: "<p>ignored</p>",
    });
  };

  async function ingest(
    job,
    sender,
    emailId,
    { invalidAddress = false, tamper = false } = {},
  ) {
    receipts.push(emailId);
    const timestamp = new Date();
    const id = "msg_" + randomUUID().replaceAll("-", "");
    const address = invalidAddress
      ? "invalid@replies.example.com"
      : replyAddress(config, job.id);
    const body = JSON.stringify({
      type: "email.received",
      data: { email_id: emailId, from: sender, to: [address] },
    });
    const headers = {
      "svix-id": id,
      "svix-timestamp": String(Math.floor(+timestamp / 1000)),
      "svix-signature": new Webhook(secret).sign(id, timestamp, body),
    };
    await controller.receipt({
      rawBody: Buffer.from(tamper ? body + " " : body),
      get: (key) => headers[key],
    });
  }

  const recipient = customer.user.email;
  const job = await createJob(recipient);
  const incorrectRecipient = await createJob("someone-else@example.com");
  const old = await createJob(recipient, 8 * 24 * 60 * 60 * 1000);
  await assert.rejects(ingest(job, recipient, randomUUID(), { tamper: true }), {
    status: 401,
  });
  await ingest(job, recipient, randomUUID(), { invalidAddress: true });
  await ingest(job, "someone-else@example.com", randomUUID());
  await ingest(old, recipient, randomUUID());
  assert.equal(requests, 0);
  await ingest(incorrectRecipient, incorrectRecipient.recipient, randomUUID());
  assert.equal(await db.travelMessage.count({ where: { content: marker } }), 0);

  await db.travelTicket.update({
    where: { id: ticket.id },
    data: { status: "CLOSED" },
  });
  try {
    const before = requests;
    await ingest(job, recipient, randomUUID());
    assert.equal(requests, before);
  } finally {
    await db.travelTicket.update({
      where: { id: ticket.id },
      data: { status: ticket.status },
    });
  }

  const emailId = randomUUID();
  await Promise.all(
    Array.from({ length: 3 }, () => ingest(job, recipient, emailId)),
  );
  await ingest(job, recipient, emailId);
  const messages = await db.travelMessage.findMany({
    where: { content: marker },
  });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].ticketId, ticket.id);
  assert.equal(messages[0].senderId, customer.userId);
  assert.equal(messages[0].visibility, "CUSTOMER");
  assert.equal(
    await db.travelMailJob.count({ where: { messageId: messages[0].id } }),
    0,
  );
  assert.equal(
    await db.travelInboundMail.count({ where: { id: { in: receipts } } }),
    1,
  );
  console.log(
    "PASS: signed customer reply, invalid signature and address, wrong and stale customer, expiry, concurrent replay deduplication, and no outbox loop.",
  );

  const supplier = await db.travelProfile.findUniqueOrThrow({
    where: { userId: "supplier-user" },
    include: { user: true, supplier: true },
  });
  assert.equal(supplier.kind, "SUPPLIER");
  assert(supplier.supplier);
  supplierMailbox = supplier.supplier;
  const booking = await db.travelBooking.findFirstOrThrow({
    where: { supplierId: supplier.supplierId },
  });
  supplierTicket = await db.travelTicket.create({
    data: {
      reference: "SUPPLIER-INBOUND-" + randomUUID(),
      title: "Supplier inbound smoke",
      description: "Temporary isolated case",
      agencyId: booking.agencyId,
      customerId: booking.customerId,
      bookingId: booking.id,
      category: ticket.category,
      status: "WAITING_SUPPLIER",
      region: ticket.region,
      deadline: new Date(Date.now() + 86_400_000),
    },
  });
  const conversation = await db.travelConversation.create({
    data: {
      ticketId: supplierTicket.id,
      supplierId: supplier.supplierId,
      subject: "Fixture conversation",
      dueAt: new Date(Date.now() + 86_400_000),
    },
  });
  const supplierEmail = supplier.user.email;
  const supplierJob = await createJob(supplierEmail, 0, conversation);
  delete process.env.OPSDESK_MAIL_SUPPLIER_REPLIES;
  const before = requests;
  await ingest(supplierJob, supplierEmail, randomUUID());
  assert.equal(requests, before, "Supplier opt-in is required");
  process.env.OPSDESK_MAIL_SUPPLIER_REPLIES = "true";
  await ingest(supplierJob, supplierEmail, randomUUID());
  assert.equal(
    await db.travelMessage.count({
      where: { conversationId: conversation.id },
    }),
    1,
  );
  await db.travelSupplier.update({
    where: { id: supplier.supplierId },
    data: { email: supplierEmail },
  });

  await db.travelConversation.update({
    where: { id: conversation.id },
    data: { status: "CLOSED" },
  });
  const beforeClosed = requests;
  await ingest(supplierJob, supplierEmail, randomUUID());
  assert.equal(requests, beforeClosed);
  await db.travelConversation.update({
    where: { id: conversation.id },
    data: { status: "AWAITING_REPLY" },
  });

  const otherBooking = await db.travelBooking.findFirstOrThrow({
    where: { supplierId: { not: supplier.supplierId } },
  });
  await db.travelTicket.update({
    where: { id: supplierTicket.id },
    data: { bookingId: otherBooking.id },
  });
  await ingest(supplierJob, supplierEmail, randomUUID());
  assert.equal(
    await db.travelMessage.count({
      where: { conversationId: conversation.id },
    }),
    1,
  );
  await db.travelTicket.update({
    where: { id: supplierTicket.id },
    data: { bookingId: booking.id },
  });

  const supplierEmailId = randomUUID();
  await Promise.all(
    Array.from({ length: 3 }, () =>
      ingest(supplierJob, supplierEmail, supplierEmailId),
    ),
  );
  const supplierMessages = await db.travelMessage.findMany({
    where: { conversationId: conversation.id, content: marker },
  });
  assert.equal(supplierMessages.length, 1);
  assert.equal(supplierMessages[0].visibility, "SUPPLIER");
  assert.equal(supplierMessages[0].senderId, supplier.userId);
  assert.equal(
    await db.travelMailJob.count({
      where: { messageId: supplierMessages[0].id },
    }),
    0,
  );
  const replied = await db.travelConversation.findUniqueOrThrow({
    where: { id: conversation.id },
  });
  assert.equal(replied.status, "REPLIED");
  assert.equal(+replied.dueAt, +conversation.dueAt);
  assert.equal(
    (
      await db.travelTicket.findUniqueOrThrow({
        where: { id: supplierTicket.id },
      })
    ).status,
    "IN_PROGRESS",
  );
  assert.equal(
    await db.travelEvent.count({
      where: {
        ticketId: supplierTicket.id,
        kind: "SUPPLIER_REPLY",
        actorId: supplier.userId,
      },
    }),
    1,
  );
  console.log(
    "PASS: supplier opt-in, active mailbox mapping, changed booking and closed thread rejection, private reply, unchanged due date, workflow transition and duplicate-free audit.",
  );
} finally {
  globalThis.fetch = originalFetch;
  if (supplierTicket)
    await db.travelTicket.delete({ where: { id: supplierTicket.id } });
  if (supplierMailbox)
    await db.travelSupplier.update({
      where: { id: supplierMailbox.id },
      data: { email: supplierMailbox.email },
    });
  await db.travelInboundMail.deleteMany({ where: { id: { in: receipts } } });
  await db.travelMessage.deleteMany({
    where: { OR: [{ id: { in: sourceMessages } }, { content: marker }] },
  });
  if (ticket)
    await db.travelTicket.update({
      where: { id: ticket.id },
      data: { updatedAt: ticket.updatedAt },
    });
  await db.$disconnect();
}

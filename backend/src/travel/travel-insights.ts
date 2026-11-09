import type { TravelInsights } from '@helpdesk/shared';
import type { PrismaService } from '../../prisma/prisma.service';

export async function readTravelInsights(
  db: PrismaService,
  region: string | null,
  now: Date,
): Promise<TravelInsights> {
  // The authorized case set is shared by every aggregate in this snapshot.
  const [row] = await db.$queryRaw<{ report: TravelInsights }[]>`
    WITH clock AS (
      SELECT (${now}::timestamptz AT TIME ZONE 'UTC') AS current_time_utc
    ),
    scoped AS MATERIALIZED (
      SELECT t.id, t.category, t."bookingId", t."createdAt", t."resolvedAt", t.deadline,
             t.status NOT IN ('RESOLVED', 'CLOSED') AS is_open
      FROM "TravelTicket" t
      WHERE (${region}::text IS NULL OR t.region = ${region}::text)
    ),
    first_replies AS (
      SELECT EXTRACT(EPOCH FROM (reply."createdAt" - t."createdAt")) / 3600 AS hours
      FROM scoped t
      CROSS JOIN LATERAL (
        SELECT candidate."createdAt"
        FROM (
          SELECT m.id, m."createdAt", m."senderId"
          FROM "TravelMessage" m
          WHERE m."ticketId" = t.id AND m.visibility = 'CUSTOMER'
          ORDER BY m."createdAt", m.id
          OFFSET 1
        ) candidate
        JOIN "TravelProfile" sender ON sender."userId" = candidate."senderId"
        WHERE sender.kind IN ('AGENT', 'MANAGER')
          AND candidate."createdAt" >= t."createdAt"
        ORDER BY candidate."createdAt", candidate.id
        LIMIT 1
      ) reply
    ),
    category_totals AS (
      SELECT category, count(*) AS count FROM scoped GROUP BY category
    ),
    day_totals AS (
      SELECT t."createdAt"::date AS day, count(*) AS count
      FROM scoped t CROSS JOIN clock
      WHERE t."createdAt" >= date_trunc('day', current_time_utc) - interval '6 days'
        AND t."createdAt" <= current_time_utc
      GROUP BY t."createdAt"::date
    ),
    days AS (
      SELECT d.day::date AS date, coalesce(day_totals.count, 0) AS count
      FROM clock
      CROSS JOIN LATERAL generate_series(
        date_trunc('day', current_time_utc) - interval '6 days',
        date_trunc('day', current_time_utc),
        interval '1 day'
      ) d(day)
      LEFT JOIN day_totals ON day_totals.day = d.day::date
    ),
    repeat_bookings AS (
      SELECT "bookingId" FROM scoped
      WHERE "bookingId" IS NOT NULL GROUP BY "bookingId" HAVING count(*) > 1
    ),
    supplier_cases AS (
      SELECT b."supplierId", count(*) AS cases,
             count(*) FILTER (WHERE t.is_open) AS open
      FROM scoped t JOIN "TravelBooking" b ON b.id = t."bookingId"
      GROUP BY b."supplierId"
    ),
    supplier_overdue AS (
      SELECT c."supplierId", count(*) AS overdue
      FROM "TravelConversation" c JOIN scoped t ON t.id = c."ticketId"
      CROSS JOIN clock
      WHERE t.is_open AND c.status = 'AWAITING_REPLY' AND c."dueAt" <= current_time_utc
      GROUP BY c."supplierId"
    ),
    suppliers AS (
      SELECT s.id, s.name, coalesce(sc.cases, 0) AS cases,
             coalesce(sc.open, 0) AS open, coalesce(so.overdue, 0) AS overdue
      FROM "TravelSupplier" s
      LEFT JOIN supplier_cases sc ON sc."supplierId" = s.id
      LEFT JOIN supplier_overdue so ON so."supplierId" = s.id
      WHERE sc."supplierId" IS NOT NULL OR so."supplierId" IS NOT NULL
    )
    SELECT jsonb_build_object(
      'total', count(*),
      'closed', count(*) FILTER (WHERE NOT is_open),
      'backlog', count(*) FILTER (WHERE is_open),
      'breached', count(*) FILTER (WHERE is_open AND deadline <= current_time_utc),
      'repeatBookings', (SELECT count(*) FROM repeat_bookings),
      'medianFirstResponseHours', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY hours) FROM first_replies),
      'medianResolutionHours', percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600
      ) FILTER (WHERE NOT is_open AND "resolvedAt" >= "createdAt"),
      'categories', coalesce((SELECT jsonb_agg(category_totals ORDER BY category) FROM category_totals), '[]'),
      'days', (SELECT jsonb_agg(days ORDER BY date) FROM days),
      'suppliers', coalesce((SELECT jsonb_agg(suppliers ORDER BY name, id) FROM suppliers), '[]')
    ) AS report
    FROM scoped CROSS JOIN clock
  `;
  return row.report;
}

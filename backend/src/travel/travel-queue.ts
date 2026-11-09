import type { TravelQueuePage } from '@helpdesk/shared';
import type { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { TravelQueueDto } from './travel-queue.dto';

export type TravelTicketScope = {
  region?: string;
  agencyId?: string;
  customerId?: string;
  id?: string;
};

const PAGE_SIZE = 20;

export async function readTravelQueue(
  db: PrismaService,
  scope: TravelTicketScope,
  query: TravelQueueDto,
  userId: string,
  now: Date,
): Promise<TravelQueuePage> {
  const conditions = [Prisma.sql`TRUE`];
  if (scope.region) conditions.push(Prisma.sql`t.region = ${scope.region}`);
  if (scope.agencyId)
    conditions.push(Prisma.sql`t."agencyId" = ${scope.agencyId}`);
  if (scope.customerId)
    conditions.push(Prisma.sql`t."customerId" = ${scope.customerId}`);
  if (scope.id) conditions.push(Prisma.sql`t.id = ${scope.id}`);
  const active = Prisma.sql`t.status NOT IN ('RESOLVED', 'CLOSED')`;
  const tab = query.tab ?? 'active';
  if (tab === 'active' || tab === 'mine') conditions.push(active);
  if (tab === 'waiting')
    conditions.push(Prisma.sql`t.status = 'WAITING_SUPPLIER'`);
  if (tab === 'resolved') conditions.push(Prisma.sql`NOT (${active})`);
  if (tab === 'mine') conditions.push(Prisma.sql`t."agentId" = ${userId}`);
  if (query.status) conditions.push(Prisma.sql`t.status = ${query.status}`);
  if (query.priority)
    conditions.push(Prisma.sql`t.priority = ${query.priority}`);
  if (query.region) conditions.push(Prisma.sql`t.region = ${query.region}`);
  if (query.owner)
    conditions.push(
      query.owner === 'UNASSIGNED'
        ? Prisma.sql`t."agentId" IS NULL`
        : Prisma.sql`t."agentId" = ${query.owner}`,
    );
  if (query.deadline)
    conditions.push(
      active,
      query.deadline === 'OVERDUE'
        ? Prisma.sql`t.deadline <= clock.now_utc`
        : Prisma.sql`t.deadline > clock.now_utc AND t.deadline <= clock.now_utc + interval '1 day'`,
    );
  if (query.attention)
    conditions.push(
      active,
      Prisma.sql`(
      t.priority = 'URGENT' OR t."agentId" IS NULL OR t.deadline <= clock.now_utc
      OR EXISTS (
        SELECT 1 FROM "TravelConversation" c
        WHERE c."ticketId" = t.id AND c.status = 'AWAITING_REPLY'
          AND c."dueAt" <= clock.now_utc
      )
    )`,
    );
  if (query.search?.trim())
    conditions.push(Prisma.sql`strpos(
      lower(concat_ws(' ', t.title, t.reference, b.reference, u."firstName", u."lastName", a.name)),
      lower(${query.search.trim()})
    ) > 0`);

  const [row] = await db.$queryRaw<{ queue: TravelQueuePage }[]>`
    WITH clock AS (SELECT (${now}::timestamptz AT TIME ZONE 'UTC') AS now_utc),
    filtered AS MATERIALIZED (
      SELECT t.id, t.deadline,
             array_position(ARRAY['URGENT','HIGH','MEDIUM','LOW']::text[], t.priority) AS rank
      FROM "TravelTicket" t
      CROSS JOIN clock
      LEFT JOIN "TravelBooking" b ON b.id = t."bookingId"
      LEFT JOIN "User" u ON u.id = t."customerId"
      JOIN "TravelAgency" a ON a.id = t."agencyId"
      WHERE ${Prisma.join(conditions, ' AND ')}
    ),
    totals AS (SELECT count(*)::int AS total FROM filtered),
    pages AS (
      SELECT total, greatest(1, ceil(total::numeric / ${PAGE_SIZE}::int)::int) AS page_count
      FROM totals
    )
    SELECT jsonb_build_object(
      'total', total,
      'page', least(${query.page ?? 1}::int, page_count),
      'totalPages', page_count,
      'pageSize', ${PAGE_SIZE}::int,
      'ids', ARRAY(
        SELECT id FROM filtered
        ORDER BY rank NULLS LAST, deadline, id
        OFFSET (least(${query.page ?? 1}::int, page_count) - 1) * ${PAGE_SIZE}::int
        LIMIT ${PAGE_SIZE}::int
      )
    ) AS queue
    FROM pages
  `;
  return row.queue;
}

import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DEMO_PASSWORD } from '@helpdesk/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { seedDemoData } from '../../prisma/seed-demo-data';
import { BCRYPT_SALT_ROUNDS } from '../common/constants/auth.constants';
import {
  DEMO_RESET_TRANSACTION_TIMEOUT_MS,
  DEMO_RESET_TRANSACTION_MAX_WAIT_MS,
} from '../common/constants/admin.constants';
import { ADMIN_ERRORS } from '../common/constants/error-messages.constants';

// Response bodies from this endpoint are only ever read by the demo-reset
// GitHub Actions workflow, which just cats the body to its own log -- but
// a Prisma/Postgres error message is still unbounded in principle (e.g. a
// pathological constraint-violation message echoing back row data), so the
// detail folded into the thrown exception is capped rather than passed
// through raw.
const MAX_ERROR_DETAIL_LENGTH = 500;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Wipes every row in the database and re-inserts the demo fixture, in a
   * single transaction so a caller never observes a half-empty database
   * mid-reset. Full wipe, not a diff against seed state — this project's
   * demo accounts aren't blocked from creating/closing/reopening tickets
   * or posting messages (only the four `/users/me` self-service mutations
   * are), so real accounts and ticket data can also accumulate on the live
   * demo over time; a partial reset would leave those behind.
   *
   * Deletion order respects FK direction (children before parents):
   * Message/RefreshToken both reference User or Ticket, which must go
   * last. AiUsage doesn't need a line here -- Step 10.2 tracks the AI
   * daily limit in Redis, not a Prisma table (see schema.md). seedDemoData
   * (Step 4.1.9's extracted insert logic) then re-creates the same
   * fixture `prisma db seed` does, so a reset produces byte-identical
   * state to a fresh seed.
   *
   * The transaction's timeout is explicitly raised (see
   * admin.constants.ts) rather than left at Prisma's 5s default: this
   * runs on a ~48h cron against a Neon compute that scales to zero when
   * idle, so almost every real invocation pays a cold-start penalty on
   * top of the transaction's own round trips -- the default timeout was
   * hit in production and surfaced as a bare, undiagnosable 500.
   */
  async resetDemoData() {
    // Hashed before the transaction opens: bcrypt at cost 12 is CPU-bound
    // and doesn't touch the database, so doing it inside the transaction
    // would spend part of its (already tight) time budget on work that
    // has nothing to do with Neon round trips.
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_SALT_ROUNDS);

    try {
      const counts = await this.prisma.$transaction(
        async (tx) => {
          if (await tx.travelProfile.count())
            throw new ConflictException(
              'The helpdesk demo reset is unavailable on OpsDesk workspaces.',
            );
          await tx.message.deleteMany();
          await tx.ticket.deleteMany();
          await tx.refreshToken.deleteMany();
          await tx.user.deleteMany();

          return seedDemoData(tx, passwordHash);
        },
        {
          timeout: DEMO_RESET_TRANSACTION_TIMEOUT_MS,
          maxWait: DEMO_RESET_TRANSACTION_MAX_WAIT_MS,
        },
      );

      this.logger.log(`Demo data reset: ${JSON.stringify(counts)}`);
      return counts;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      const detail = (
        error instanceof Error ? error.message : String(error)
      ).slice(0, MAX_ERROR_DETAIL_LENGTH);

      // Full detail (including stack, when available) still goes to the
      // Cloud Run logs via the Nest logger -- this is the deep-dive path.
      // The shortened `detail` folded into the thrown exception below is
      // the fast path: it lands directly in the demo-reset workflow's own
      // log output, so a repeat failure doesn't require a trip to Cloud
      // Run Logs just to find out it was (for example) a transaction
      // timeout again.
      this.logger.error(
        `Demo data reset failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException(
        `${ADMIN_ERRORS.DEMO_RESET_FAILED} ${detail}`,
      );
    }
  }
}

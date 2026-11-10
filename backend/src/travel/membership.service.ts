import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { RateLimitService } from '../common/services/rate-limit.service';
import { BCRYPT_SALT_ROUNDS } from '../common/constants/auth.constants';
import { TravelDirectoryDto } from './travel-directory.dto';
import { readPage, TravelPageDto } from './travel-page.dto';
import {
  AcceptInvitationDto,
  InvitationDto,
  MembershipStatusDto,
  NewAgencyDto,
  NewSupplierDto,
} from './membership.dto';
type Tx = Prisma.TransactionClient;
type Member = Prisma.TravelProfileGetPayload<{ include: { user: true } }>;
const digest = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const memberView = (p: Member) => ({
  id: p.userId,
  name: `${p.user.firstName} ${p.user.lastName}`,
  email: p.user.email,
  kind: p.kind,
  status: p.status,
  agencyId: p.agencyId,
  supplierId: p.supplierId,
  region: p.region,
  available: p.available,
});
@Injectable()
export class MembershipService {
  constructor(
    private db: PrismaService,
    private limits: RateLimitService,
  ) {}
  private locked<T>(fn: (tx: Tx) => Promise<T>) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(804204)`;
        return fn(tx);
      },
      { maxWait: 15000, timeout: 20000 },
    );
  }
  private async manager(tx: Tx, userId: string) {
    const p = await tx.travelProfile.findUnique({ where: { userId } });
    if (!p || p.kind !== 'MANAGER' || p.status !== 'ACTIVE')
      throw new ForbiddenException('Active manager access required.');
  }
  private reason(reason: string) {
    const result = reason.trim();
    if (result.length < 3 || result.length > 500)
      throw new BadRequestException('Reason must contain 3–500 characters.');
    return result;
  }
  private audit(
    tx: Tx,
    actorId: string,
    entityId: string,
    action: string,
    reason: string,
  ) {
    return tx.membershipAudit.create({
      data: { actorId, entityId, action, reason: this.reason(reason) },
    });
  }
  async members(actor: string, query: TravelDirectoryDto) {
    return this.locked(async (tx) => {
      await this.manager(tx, actor);
      const term = query.search?.trim();
      const where: Prisma.TravelProfileWhereInput = {
        ...(query.kind ? { kind: query.kind } : {}),
        ...(term
          ? {
              user: {
                OR: [
                  { firstName: { contains: term, mode: 'insensitive' } },
                  { lastName: { contains: term, mode: 'insensitive' } },
                  { email: { contains: term, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      };
      return readPage(
        query,
        () => tx.travelProfile.count({ where }),
        async (skip, take) =>
          (
            await tx.travelProfile.findMany({
              where,
              include: { user: true },
              orderBy: [
                { user: { firstName: 'asc' } },
                { user: { lastName: 'asc' } },
                { userId: 'asc' },
              ],
              skip,
              take,
            })
          ).map(memberView),
      );
    });
  }
  async directory(
    actor: string,
    type: 'agency' | 'supplier',
    query: TravelDirectoryDto,
  ) {
    return this.locked(async (tx) => {
      await this.manager(tx, actor);
      const term = query.search?.trim();
      if (type === 'agency') {
        const where: Prisma.TravelAgencyWhereInput = term
          ? {
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { code: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {};
        return readPage(
          query,
          () => tx.travelAgency.count({ where }),
          (skip, take) =>
            tx.travelAgency.findMany({
              where,
              select: { id: true, name: true, code: true },
              orderBy: [{ name: 'asc' }, { id: 'asc' }],
              skip,
              take,
            }),
        );
      }
      const where: Prisma.TravelSupplierWhereInput = term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { email: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {};
      return readPage(
        query,
        () => tx.travelSupplier.count({ where }),
        (skip, take) =>
          tx.travelSupplier.findMany({
            where,
            select: {
              id: true,
              name: true,
              email: true,
              slaCalendar: true,
              responseTargetHours: true,
              responsePolicyVersion: true,
            },
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            skip,
            take,
          }),
      );
    });
  }
  async auditPage(actor: string, query: TravelPageDto) {
    return this.locked(async (tx) => {
      await this.manager(tx, actor);
      return readPage(
        query,
        () => tx.membershipAudit.count(),
        (skip, take) =>
          tx.membershipAudit.findMany({
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip,
            take,
          }),
      );
    });
  }
  private async issue(
    tx: Tx,
    member: Member,
    actor: string,
    reason: string,
    action: string,
  ) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 3600000);
    await tx.travelInvitation.updateMany({
      where: { memberId: member.userId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.travelInvitation.create({
      data: { memberId: member.userId, tokenHash: digest(token), expiresAt },
    });
    await this.audit(tx, actor, member.userId, action, reason);
    return { member: memberView(member), token, expiresAt };
  }
  async invite(actor: string, dto: InvitationDto) {
    // Reject unauthorized callers before spending bcrypt work. The locked
    // transaction below rechecks authority against concurrent suspension.
    await this.manager(this.db, actor);
    // A random unshared secret leaves the initial password unusable until acceptance.
    const passwordHash = await bcrypt.hash(
      randomBytes(32).toString('hex'),
      BCRYPT_SALT_ROUNDS,
    );
    return this.locked(async (tx) => {
      await this.manager(tx, actor);
      this.reason(dto.reason);
      const email = dto.email.trim().toLowerCase();
      if (await tx.user.findUnique({ where: { email } }))
        throw new ConflictException('Email already in use.');
      let region: string | null = null;
      if (['CUSTOMER', 'AGENCY'].includes(dto.kind)) {
        if (
          !dto.agencyId ||
          dto.supplierId !== undefined ||
          dto.region !== undefined ||
          !(await tx.travelAgency.findUnique({ where: { id: dto.agencyId } }))
        )
          throw new BadRequestException(
            'Choose an existing agency with no supplier or region.',
          );
      } else if (dto.kind === 'SUPPLIER') {
        if (
          !dto.supplierId ||
          dto.agencyId !== undefined ||
          dto.region !== undefined ||
          !(await tx.travelSupplier.findUnique({
            where: { id: dto.supplierId },
          }))
        )
          throw new BadRequestException(
            'Choose an existing supplier with no agency or region.',
          );
      } else {
        if (dto.agencyId !== undefined || dto.supplierId !== undefined)
          throw new BadRequestException(
            'Staff cannot have agency or supplier scope.',
          );
        region = dto.kind === 'MANAGER' ? 'GLOBAL' : (dto.region ?? null);
        if (
          !region ||
          (dto.kind === 'MANAGER' &&
            dto.region !== undefined &&
            dto.region !== 'GLOBAL')
        )
          throw new BadRequestException('Choose a valid staff region.');
      }
      const user = await tx.user.create({
        data: {
          email,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          passwordHash,
          role:
            dto.kind === 'MANAGER'
              ? 'ADMIN'
              : dto.kind === 'AGENT'
                ? 'AGENT'
                : 'CUSTOMER',
        },
      });
      const member = await tx.travelProfile.create({
        data: {
          userId: user.id,
          kind: dto.kind,
          agencyId: dto.agencyId,
          supplierId: dto.supplierId,
          region,
          status: 'INVITED',
        },
        include: { user: true },
      });
      return this.issue(tx, member, actor, dto.reason, 'MEMBER_INVITED');
    });
  }
  async reissue(actor: string, userId: string, reason: string) {
    return this.locked(async (tx) => {
      await this.manager(tx, actor);
      const target = await tx.travelProfile.findUnique({ where: { userId } });
      if (!target) throw new NotFoundException('Member not found.');
      if (target.status === 'ACTIVE')
        throw new BadRequestException(
          'Active members cannot be invited again.',
        );
      const member = await tx.travelProfile.update({
        where: { userId },
        data: { status: 'INVITED', sessionVersion: { increment: 1 } },
        include: { user: true },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      });
      return this.issue(tx, member, actor, reason, 'INVITATION_REISSUED');
    });
  }
  async status(actor: string, userId: string, dto: MembershipStatusDto) {
    return this.locked(async (tx) => {
      await this.manager(tx, actor);
      this.reason(dto.reason);
      const target = await tx.travelProfile.findUnique({
        where: { userId },
        include: { user: true },
      });
      if (!target) throw new NotFoundException('Member not found.');
      if (target.status === dto.status) return { member: memberView(target) };
      if (target.status === 'INVITED')
        throw new BadRequestException(
          'Invited members must accept an invitation.',
        );
      if (dto.status === 'SUSPENDED') {
        if (userId === actor)
          throw new BadRequestException('You cannot suspend yourself.');
        if (
          target.kind === 'MANAGER' &&
          (await tx.travelProfile.count({
            where: { kind: 'MANAGER', status: 'ACTIVE' },
          })) <= 1
        )
          throw new BadRequestException(
            'The last active manager cannot be suspended.',
          );
      }
      const member = await tx.travelProfile.update({
        where: { userId },
        data: {
          status: dto.status,
          ...(dto.status === 'SUSPENDED'
            ? { sessionVersion: { increment: 1 } }
            : {}),
        },
        include: { user: true },
      });
      if (dto.status === 'SUSPENDED')
        await tx.refreshToken.updateMany({
          where: { userId, revoked: false },
          data: { revoked: true },
        });
      await this.audit(
        tx,
        actor,
        userId,
        dto.status === 'SUSPENDED' ? 'MEMBER_SUSPENDED' : 'MEMBER_REACTIVATED',
        dto.reason,
      );
      return { member: memberView(member) };
    });
  }
  async agency(actor: string, dto: NewAgencyDto) {
    return this.locked(async (tx) => {
      await this.manager(tx, actor);
      const code = dto.code.trim().toUpperCase();
      if (await tx.travelAgency.findUnique({ where: { code } }))
        throw new ConflictException('Agency code already in use.');
      const agency = await tx.travelAgency.create({
        data: { id: randomUUID(), name: dto.name.trim(), code },
      });
      await this.audit(tx, actor, agency.id, 'AGENCY_CREATED', dto.reason);
      return agency;
    });
  }
  async supplier(actor: string, dto: NewSupplierDto) {
    return this.locked(async (tx) => {
      await this.manager(tx, actor);
      const supplier = await tx.travelSupplier.create({
        data: {
          id: randomUUID(),
          name: dto.name.trim(),
          email: dto.email.trim().toLowerCase(),
        },
      });
      await this.audit(tx, actor, supplier.id, 'SUPPLIER_CREATED', dto.reason);
      return supplier;
    });
  }
  async accept(dto: AcceptInvitationDto, ip: string) {
    const tokenHash = digest(dto.token);
    const valid = (
      inv: {
        usedAt: Date | null;
        revokedAt: Date | null;
        expiresAt: Date;
      } | null,
    ) => inv && !inv.usedAt && !inv.revokedAt && inv.expiresAt > new Date();
    const invalid = () =>
      new BadRequestException('Invitation is invalid or expired.');
    const preview = await this.db.travelInvitation.findUnique({
      where: { tokenHash },
    });
    if (!valid(preview)) throw invalid();
    // The Next proxy shares a connection IP across visitors. Scope expensive
    // valid-token work to both invitation and IP so one invitation cannot
    // consume every other member's budget. Invalid tokens allocate no keys.
    const key = `invitation-accept:${RateLimitService.hashIdentifier(ip)}:${tokenHash}`;
    await this.limits.increment(key, 900);
    if ((await this.limits.getCount(key)) > 20)
      throw new HttpException(
        'Too many invitation attempts. Try again later.',
        429,
      );
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    return this.locked(async (tx) => {
      const invitation = await tx.travelInvitation.findUnique({
        where: { tokenHash },
        include: { member: true },
      });
      if (
        !invitation ||
        !valid(invitation) ||
        invitation.member.status !== 'INVITED'
      )
        throw invalid();
      await tx.travelInvitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });
      await tx.user.update({
        where: { id: invitation.memberId },
        data: { passwordHash },
      });
      await tx.travelProfile.update({
        where: { userId: invitation.memberId },
        data: { status: 'ACTIVE' },
      });
      await this.audit(
        tx,
        invitation.memberId,
        invitation.memberId,
        'INVITATION_ACCEPTED',
        'Member accepted invitation.',
      );
      return { accepted: true };
    });
  }
}

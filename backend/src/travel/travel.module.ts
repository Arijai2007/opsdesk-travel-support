import {
  MembershipController,
  InvitationController,
} from './membership.controller';
import { MembershipService } from './membership.service';
import { Module } from '@nestjs/common';
import { TravelController } from './travel.controller';
import { TravelService } from './travel.service';
import { OpsHealthController } from './ops-health.controller';
@Module({
  controllers: [
    TravelController,
    OpsHealthController,
    MembershipController,
    InvitationController,
  ],
  providers: [TravelService, MembershipService],
})
export class TravelModule {}

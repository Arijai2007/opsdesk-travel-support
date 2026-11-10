import {
  MembershipController,
  InvitationController,
} from './membership.controller';
import { MembershipService } from './membership.service';
import { Module } from '@nestjs/common';
import { TravelController } from './travel.controller';
import { TravelService } from './travel.service';
import { OpsHealthController } from './ops-health.controller';
import { TravelMailController } from './travel-mail.controller';
import { TravelMailService } from './travel-mail.service';
import {
  SyntheticTravelMailTransport,
  TravelMailTransport,
} from './travel-mail.transport';
@Module({
  controllers: [
    TravelController,
    OpsHealthController,
    MembershipController,
    InvitationController,
    TravelMailController,
  ],
  providers: [
    TravelService,
    MembershipService,
    TravelMailService,
    { provide: TravelMailTransport, useClass: SyntheticTravelMailTransport },
  ],
})
export class TravelModule {}

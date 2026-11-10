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
import { ResendTravelMailTransport } from './resend-mail.transport';
import { ResendMailWebhookController } from './resend-mail-webhook.controller';
import { TravelAttachmentsController } from './travel-attachments.controller';
import { TravelAttachmentsService } from './travel-attachments.service';
import { BookingRequestsService } from './booking-requests.service';
import { BookingRequestsController } from './booking-requests.controller';
@Module({
  controllers: [
    TravelController,
    OpsHealthController,
    MembershipController,
    InvitationController,
    TravelMailController,
    ResendMailWebhookController,
    TravelAttachmentsController,
    BookingRequestsController,
  ],
  providers: [
    TravelService,
    MembershipService,
    TravelMailService,
    ResendTravelMailTransport,
    TravelAttachmentsService,
    BookingRequestsService,
    { provide: TravelMailTransport, useClass: SyntheticTravelMailTransport },
  ],
})
export class TravelModule {}

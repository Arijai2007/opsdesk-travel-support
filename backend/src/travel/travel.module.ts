import { Module } from '@nestjs/common';
import { TravelController } from './travel.controller';
import { TravelService } from './travel.service';
import { OpsHealthController } from './ops-health.controller';
@Module({
  controllers: [TravelController, OpsHealthController],
  providers: [TravelService],
})
export class TravelModule {}

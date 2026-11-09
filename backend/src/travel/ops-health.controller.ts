import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TravelService } from './travel.service';

@Controller('health')
export class OpsHealthController {
  constructor(
    private readonly db: PrismaService,
    private readonly counters: RedisService,
    private readonly travel: TravelService,
  ) {}

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async readiness() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      if (this.counters.isReady()) return { status: 'ready' };
    } catch {
      // Keep connection errors and configuration out of the public response.
    }
    throw new ServiceUnavailableException('Service not ready.');
  }

  @Get('worker')
  @Header('Cache-Control', 'no-store')
  worker() {
    if (!this.travel.workerHealthy())
      throw new ServiceUnavailableException('Deadline worker not ready.');
    return { status: 'ready' };
  }
}

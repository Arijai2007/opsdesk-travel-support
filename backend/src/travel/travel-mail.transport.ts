import { Injectable } from '@nestjs/common';

export abstract class TravelMailTransport {
  abstract deliver(envelope: {
    idempotencyKey: string;
    recipient: string;
    text: string;
  }): Promise<void>;
}

@Injectable()
export class SyntheticTravelMailTransport extends TravelMailTransport {
  async deliver(): Promise<void> {
    // Synthetic delivery has no network client and persists no mail body.
    await Promise.resolve();
  }
}

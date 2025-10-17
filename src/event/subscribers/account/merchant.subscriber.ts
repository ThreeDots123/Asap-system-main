import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import events from "src/event";
import { Merchant } from "src/models/merchant.entity";

export class MerchantAcctCreatedEvent {
  constructor(
    public readonly merchant: Merchant,
    public readonly otp: string | number,
  ) {}
}

const {
  account: { created },
} = events;

@Injectable()
export class MerchantAccountSubscriber {
  private readonly logger = new Logger(MerchantAccountSubscriber.name);
  // Import mail service
  constructor() {}

  @OnEvent(created.merchant)
  async handleCreatedAccount(data: {
    event: MerchantAcctCreatedEvent;
    eventId?: string;
  }) {
    const {
      event: { merchant, otp },
    } = data;

    try {
      this.logger.log(`Account created for user, ${merchant.businessName}`);

      // Send mail for email/account verification
    } catch (err) {
      throw new Error(
        "An Error occured while processing post creation activities for " +
          merchant.businessName,
        err.message,
      );
    }
  }
}

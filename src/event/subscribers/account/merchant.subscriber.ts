import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { EmailService } from "src/email/email.service";
import events from "src/event";
import { Merchant } from "src/models/merchant.entity";

export class MerchantAcctCreatedEvent {
  constructor(public readonly merchant: Merchant) {}
}

const {
  account: { created },
} = events;

@Injectable()
export class MerchantAccountSubscriber {
  private readonly logger = new Logger(MerchantAccountSubscriber.name);
  // Import mail service
  constructor(private emailService: EmailService) {}

  @OnEvent(created.merchant)
  async handleCreatedAccount(data: {
    event: MerchantAcctCreatedEvent;
    eventId?: string;
  }) {
    const {
      event: { merchant },
    } = data;

    try {
      this.logger.log(`Account created for user, ${merchant.businessName}`);

      // Send mail to welcome the merchant
      // await this.emailService.sendMail(
      //   [merchant.email],
      //   "Welcome to the ASAP Merchant Platform",
      // );
    } catch (err) {
      throw new Error(
        "An Error occured while processing post creation activities for " +
          merchant.businessName,
        err.message,
      );
    }
  }
}

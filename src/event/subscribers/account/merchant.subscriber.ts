import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { EmailService } from "src/email/email.service";
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
  constructor(private emailService: EmailService) {}

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
      await this.emailService.sendMail(
        merchant.email,
        "Verify your account",
        `Please verify your email address by clicking the link below:

        ${otp}

        If you did not create an account with ASAP Merchant, please ignore this email.

        Best regards,  
        The {{appName}} Team
      `,
      );
    } catch (err) {
      throw new Error(
        "An Error occured while processing post creation activities for " +
          merchant.businessName,
        err.message,
      );
    }
  }
}

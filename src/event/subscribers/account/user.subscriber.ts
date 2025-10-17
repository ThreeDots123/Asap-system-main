import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { CountryCode } from "libphonenumber-js";
import events from "src/event";
import { User } from "src/models/user.entity";
import { SmsService } from "src/sms/sms.service";

export class UserAcctCreatedEvent {
  constructor(
    public readonly user: User,
    public readonly otp: string | number,
  ) {}
}

const {
  account: { created },
} = events;

@Injectable()
export class UserAccountSubscriber {
  private readonly logger = new Logger(UserAccountSubscriber.name);

  constructor(private smsService: SmsService) {}

  @OnEvent(created.user)
  async handleCreatedAccount(data: {
    event: UserAcctCreatedEvent;
    eventId?: string;
  }) {
    const {
      event: { user, otp },
    } = data;
    try {
      this.logger.log(`Account created for user, ${user.username}`);
      // Send SMS to user phone for verification
      await this.smsService.smsSingleUser(
        { phone: user.phone, countryCode: user.country as CountryCode },
        "DO NOT DISCLOSE. Please use this one time password " +
          otp +
          " to complete your verification. The code will expire in 1 minute.",
      );
    } catch (err) {
      throw new Error(
        "An Error occured while processing account creation for " +
          user.username,
        err.message,
      );
    }
  }
}

import twilio from "twilio";
import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from "@nestjs/common";
import { AbstractSMSProcessor } from "../../../interface/sms/abstract-processor";
import { ConfigService } from "@nestjs/config";
import { TWILIO_ACCT, TWILIO_PHONE, TWILIO_TOKEN } from "src/config/env/list";

export const providerId = "twilio";

@Injectable()
export class TwilioSMSProcessor
  extends AbstractSMSProcessor
  implements OnModuleInit
{
  private client: ReturnType<typeof twilio>;
  private fromPhone: string;
  private readonly providerId = providerId;

  constructor(private configService: ConfigService) {
    super();
    this.fromPhone = configService.getOrThrow<string>(TWILIO_PHONE);
  }

  onModuleInit() {
    // Initialising the twilio processor [Switch to its own module if it becomes needed in multiple application sessions to ensure singular initialization]
    this.client = twilio(
      this.configService.getOrThrow<string>(TWILIO_ACCT),
      this.configService.getOrThrow<string>(TWILIO_TOKEN),
    );
  }

  public getProviderId() {
    return this.providerId;
  }

  protected async processSmsToSingleUser(
    to: string,
    message: string,
  ): Promise<string> {
    try {
      const response = await this.client.messages.create({
        body: message,
        from: this.fromPhone,
        to,
      });

      return response.sid;
    } catch (err) {
      throw new InternalServerErrorException("Falied to send SMS", err.message);
    }
  }
}

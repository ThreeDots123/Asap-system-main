import { Injectable, OnModuleInit } from "@nestjs/common";
import { AbstractSMSProcessor } from "src/interface/sms/abstract-processor";
import { TwilioSMSProcessor } from "./processors/twilio/index.processor";
import { ProcessorOpts } from "./processors";
import { CountryCode } from "libphonenumber-js";

@Injectable()
export class SmsService implements OnModuleInit {
  constructor(private readonly twilioProcessor: TwilioSMSProcessor) {}
  private processors: Map<string, AbstractSMSProcessor> = new Map();

  async onModuleInit() {
    await this.registerProcessors();

    // Should persist them to db when tracking of sms starts to become necessary
  }

  private async registerProcessors(): Promise<void> {
    // Register each processor with its provider ID on the instantiated service
    await this.registerProcessor(this.twilioProcessor);
  }

  private async registerProcessor(
    processor: AbstractSMSProcessor,
  ): Promise<void> {
    const providerId = await processor.getProviderId();

    if (this.processors.has(providerId))
      throw new Error(
        "Processor with a providerId of " + providerId + " already exists",
      );

    // Append provider to intance service
    this.processors.set(providerId, processor);
  }

  getProcessor(providerId: string): AbstractSMSProcessor {
    const processor = this.processors.get(providerId);
    if (!processor) {
      throw new Error(`SMS processor for provider ID ${providerId} not found`);
    }
    return processor;
  }

  async smsSingleUser(
    details: { phone: string; countryCode: CountryCode },
    message: string,
    providerId = ProcessorOpts.twilio,
  ) {
    const { phone, countryCode } = details;

    const processor = this.getProcessor(providerId);
    return processor.sendSmsToSingleUser(
      { phone, country: countryCode },
      message,
    );
  }
}

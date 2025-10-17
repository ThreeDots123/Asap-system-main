import { Injectable } from "@nestjs/common";
import { CountryCode } from "libphonenumber-js";
import toInternationalFormat from "src/utils/to-intl-format";

@Injectable()
export abstract class AbstractSMSProcessor {
  constructor() {}

  public async sendSmsToSingleUser(
    phoneCred: { phone: string; country: CountryCode },
    message: string,
  ) {
    const { phone, country } = phoneCred;

    // Ensure the number is in international format
    const phoneIntlFmt = toInternationalFormat(phone, country);
    // Call provider-specific implementation
    return this.processSmsToSingleUser(phoneIntlFmt, message);
  }

  public abstract getProviderId(): Promise<string> | string;

  protected abstract processSmsToSingleUser(
    to: string,
    message: string,
  ): Promise<string>;
}

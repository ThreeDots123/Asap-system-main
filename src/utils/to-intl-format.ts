import { InternalServerErrorException } from "@nestjs/common";
import { parsePhoneNumberFromString, CountryCode } from "libphonenumber-js";

/**
 * Parses a phone number string and attempts to format it into the E.164 international standard.
 * E.164 format is a plus sign (+) followed by the country code and the number, with no spaces or symbols.
 * Example: +14155552671
 *
 * @param phoneNumber The phone number string to parse. Can be in various local formats.
 * @param defaultCountry The ISO 3166-1 alpha-2 country code to assume if the number is not in international format.
 * @returns The formatted E.164 phone number string, or null if the number is invalid.
 */
export default function toInternationalFormat(
  phoneNumber: string,
  defaultCountry: CountryCode = "NG",
): string {
  if (!phoneNumber)
    throw new InternalServerErrorException("Invalid phone number passed");

  try {
    // The library parses the number string based on the default country.
    const phoneNumberObj = parsePhoneNumberFromString(
      phoneNumber,
      defaultCountry,
    );

    // Check if the number is valid. If not, return null.
    if (!phoneNumberObj || !phoneNumberObj.isValid())
      throw new InternalServerErrorException("Invalid phone number passed");

    // Return the number in E.164 format.
    return phoneNumberObj.format("E.164");
  } catch (error) {
    // The library can throw an error for grossly malformed strings.
    throw new InternalServerErrorException(
      `Error parsing phone number "${phoneNumber}":`,
      error,
    );
  }
}

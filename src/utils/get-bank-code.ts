import { BadRequestException } from "@nestjs/common";
import NIGERIAN_BANKS from "src/common/banks";

/**
 * Finds the bank code for a given bank name.
 * The lookup is case-insensitive.
 * @param bankName The name of the bank.
 * @returns The corresponding bank code.
 * @throws BadRequestException if the bank name is not found.
 */
export function getBankCode(bankName: string): string {
  if (!bankName) {
    throw new BadRequestException("Bank name cannot be empty.");
  }

  const code = NIGERIAN_BANKS.get(bankName.toLowerCase());

  if (!code) {
    throw new BadRequestException(
      `Invalid or unsupported bank name provided: "${bankName}"`,
    );
  }

  return code;
}

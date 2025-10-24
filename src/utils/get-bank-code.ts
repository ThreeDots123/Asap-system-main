import { BadRequestException } from "@nestjs/common";
import NIGERIAN_BANKS from "src/common/banks";

// Create reverse lookup map
const BANK_CODES_TO_NAMES = new Map<string, string>(
  Array.from(NIGERIAN_BANKS.entries()).map(([name, code]) => [code, name]),
);

export function getBankCode(bankName: string): string {
  if (!bankName) throw new BadRequestException("Bank name cannot be empty.");

  const code = NIGERIAN_BANKS.get(bankName.toLowerCase());
  if (!code)
    throw new BadRequestException(
      `Invalid or unsupported bank name: "${bankName}"`,
    );

  return code;
}

export function getBankName(code: string): string {
  if (!code) throw new BadRequestException("Bank code cannot be empty.");

  const name = BANK_CODES_TO_NAMES.get(code);
  if (!name)
    throw new BadRequestException(
      `Invalid or unsupported bank code: "${code}"`,
    );

  return name;
}

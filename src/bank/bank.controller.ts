import { Body, Controller, Post } from "@nestjs/common";
import { BankService } from "./bank.service";
import { ValidateBankDto } from "./dto/validate-bank.dto";

@Controller("bank")
export class BankController {
  constructor(private readonly bankService: BankService) {}

  @Post("validate")
  async validateBank(@Body() dto: ValidateBankDto) {
    return await this.bankService.validateBankDetails(
      dto.bank_code,
      dto.account_number,
    );
  }
}

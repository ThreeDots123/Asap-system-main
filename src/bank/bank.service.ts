import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { PAYSTACK_SECRET } from "src/config/env/list";

@Injectable()
export class BankService {
  constructor(private configService: ConfigService) {}

  async validateBankDetails(bank_code: string, account_number: string) {
    try {
      const response = await axios.get("https://api.paystack.co/bank/resolve", {
        params: { bank_code, account_number },
        headers: {
          Authorization: `Bearer ${this.configService.getOrThrow(PAYSTACK_SECRET)}`,
        },
      });

      const data = response.data;

      if (!data.status) {
        throw new HttpException(data.message, HttpStatus.BAD_REQUEST);
      }

      return {
        account_name: data.data.account_name,
        account_number: data.data.account_number,
        bank_code,
      };
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to verify bank details";
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }
}

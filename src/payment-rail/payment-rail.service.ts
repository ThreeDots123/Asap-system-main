import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { distance } from "fastest-levenshtein";
import { CountryCode } from "libphonenumber-js";
import { ConfigService } from "@nestjs/config";
import { PAYSTACK_SECRET } from "src/config/env/list";
import { TransactionService } from "src/transaction/transaction.service";
import { AuthService } from "src/auth/auth.service";
import { OfframpService } from "src/offramp/offramp.service";
import { Types } from "mongoose";

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/\./g, "") // remove dots
    .replace(/\s+/g, " ") // collapse multiple spaces
    .trim();
}

@Injectable()
export class PaymentRailService {
  constructor(
    private configService: ConfigService,
    private transactionService: TransactionService,
    private offrampService: OfframpService,
  ) {}

  async processPayment(reference: string) {
    const transaction =
      await this.transactionService.retrieveAuthorizedOfframpTransaction(
        reference,
      );

    if (!transaction)
      throw new BadRequestException(
        "This transaction was not found or is not authorised.",
      );

    const {
      metadata: { walletUsed },
    } = transaction;

    if (walletUsed === "internal") {
      // Fetch the wallet withdrawal transaction tied to this offramp transaction
      const coinWithdrawalTxn =
        await this.transactionService.retrieveOfframpCoinWithdrawalTransaction(
          transaction._id as Types.ObjectId,
        );

      if (!coinWithdrawalTxn)
        throw new InternalServerErrorException(
          "No transaction found for offramp's coin withdrawal.",
        );

      const response = await this.offrampService.initiate({
        walletType: "internal",
        transactionRef: coinWithdrawalTxn.transactionReference,
        userId: coinWithdrawalTxn.userId,
        offrampTxn: transaction,
      });

      return response;
    }

    const response = await this.offrampService.initiate({
      walletType: "external",
      offrampTxn: transaction,
    });

    return response;
  }

  async verifyBankDetails(
    countryCode: CountryCode,
    acctNo: string,
    bankCode: string,
    acctName: string,
  ) {
    switch (countryCode) {
      case "GH":
      case "NG": {
        try {
          const response = await fetch(
            `https://api.paystack.co/bank/resolve?account_number=${acctNo}&bank_code=${bankCode}`,
            {
              headers: {
                Authorization:
                  "Bearer " +
                  this.configService.getOrThrow<string>(PAYSTACK_SECRET),
              },
            },
          );
          const data: {
            status: boolean;
            message: string;
            data: {
              account_number: string;
              account_name: string;
              bank_id: number;
            };
          } = await response.json();

          console.log(data);

          if (!data.status) return false;

          const n1 = normalizeName(acctName);
          const n2 = normalizeName(data.data.account_name);

          const d = distance(n1, n2);
          const maxLen = Math.max(n1.length, n2.length);
          const similarity = 1 - d / maxLen;

          console.log(n1, n2, similarity, acctName);

          return similarity >= 0.1; // 75% similar
        } catch (err) {
          throw new BadRequestException(
            "The Account Details received is not correct.",
          );
        }
      }

      case "SA":
        //
        return false;

      default:
        throw new InternalServerErrorException(
          "Country code " + countryCode + " is not recognised by the server.",
        );
    }
  }
}

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { PaymentService } from "src/payment/payment.service";
import { AvailableWalletChains } from "src/common/types/wallet-custody";
import { UserDocument } from "src/models/user.entity";
import { TransactionStatus } from "src/models/wallet/transaction.entity";
import { Types } from "mongoose";
import { CountryCode } from "libphonenumber-js";
import {
  PaymentOrigin,
  PaymentTransactionStatus,
} from "src/models/offramp-transaction";
import { AuthService } from "src/auth/auth.service";
import { TransactionService } from "src/transaction/transaction.service";

@Injectable()
export class SendService {
  constructor(
    private paymentService: PaymentService,
    private authService: AuthService,
    private transactionService: TransactionService,
  ) {}

  async initiateSendToRecipient(
    userId: Types.ObjectId,
    details: {
      countryCode: CountryCode;
      walletUsed: "internal" | "external";
      origin: PaymentOrigin.EXTERNAL | PaymentOrigin.INTERNAL;
      amount: string;
      currency: string;
      bank: {
        code: string;
        ownerName: string;
        acctNumber: string;
      };
      coin: {
        asset: string;
        chain: AvailableWalletChains;
      };
    },
  ) {
    const {
      countryCode,
      walletUsed,
      origin,
      bank: { code, ownerName, acctNumber },
      coin: { asset, chain },
      currency,
      amount,
    } = details;

    return this.paymentService.initiatePaymentRequest(
      {
        bankDetails: {
          code,
          ownerName,
          number: acctNumber,
        },
        coinToReceive: {
          assetChain: chain,
          asset,
        },
        amountToSend: { currency, amount },
      },
      countryCode,
      {
        type: "external",
        origin,
        walletUsed,
      },
      userId,
    );
  }

  async authoriseSendSession(
    sessionToken: string,
    user: UserDocument,
    pin: string,
  ) {
    const { reference } =
      await this.authService.verifyPaymentSession(sessionToken);

    const transaction =
      await this.transactionService.retrieveInitiatedOfframpTransaction(
        reference,
      );

    if (!transaction)
      throw new BadRequestException(
        "There was not payment transaction attached to this session. Cannot authorise.",
      );

    // Find the associated
    const offrampWithdrawalTxn =
      await this.transactionService.retrieveInitiatedOfframpCoinWithdrawalTransaction(
        transaction._id as Types.ObjectId,
      );

    if (!offrampWithdrawalTxn)
      throw new InternalServerErrorException(
        "Cannot find the asset withdrwal transaction associated with this payment.",
      );

    const { securityChecks } = transaction;

    if (!securityChecks) {
      transaction.status === PaymentTransactionStatus.AUTHORIZED;
      offrampWithdrawalTxn.status === TransactionStatus.AUTHORIZED;

      await transaction.save();
      await offrampWithdrawalTxn.save();

      return {
        message: "Your transaction has been authorised.",
        requiresMfa: false,
        session: sessionToken,
      };
    } else {
      const { pinVerified, mfaVerified } = securityChecks;

      if (pinVerified !== undefined) {
        const isValid = await user.comparePin(pin);

        if (isValid) {
          const requiresMFA = mfaVerified !== undefined ? !mfaVerified : false;

          // @ts-ignore
          transaction.securityChecks.pinVerified = true;
          if (
            offrampWithdrawalTxn.securityChecks &&
            offrampWithdrawalTxn.securityChecks.pinVerified
          )
            offrampWithdrawalTxn.securityChecks.pinVerified = true;

          if (!requiresMFA) {
            transaction.status = PaymentTransactionStatus.AUTHORIZED;
            offrampWithdrawalTxn.status = TransactionStatus.AUTHORIZED;
          }

          await offrampWithdrawalTxn.save();
          await transaction.save();

          return {
            message: requiresMFA
              ? "Pin authorisation successful."
              : "Your transaction has been authorised.",
            requiresMFA,
          };
        }

        throw new BadRequestException("Invalid transaction pin.");
      }

      return {
        message: "Your transaction has been authorised.",
        requiresMfa: false,
      };
    }
  }

  async processSend(sessionToken: string) {
    return this.paymentService.processPayment(sessionToken);
  }
}

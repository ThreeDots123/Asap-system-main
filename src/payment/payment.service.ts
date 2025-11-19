import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { CountryCode } from "libphonenumber-js";
import { Types } from "mongoose";
import { AuthService } from "src/auth/auth.service";
import { AvailableWalletChains } from "src/common/types/wallet-custody";
import { LiquidityProviderService } from "src/liquidity-provider/liquidity-provider.service";
import {
  PaymentOrigin,
  PaymentTransactionStatus,
} from "src/models/offramp-transaction";

import { PaymentRailService } from "src/payment-rail/payment-rail.service";
import {
  InitiateMerchantPMTParams,
  PaymentTxnParams,
} from "src/payment-rail/types";
import { RateService } from "src/rate/rate.service";
import { TransactionService } from "src/transaction/transaction.service";
import securityChecks from "src/utils/security-checks";
import { WalletCustodialService } from "src/wallet-custodial/wallet-custodial.service";

@Injectable()
export class PaymentService {
  constructor(
    private paymentRailService: PaymentRailService,
    private liquidityProviderService: LiquidityProviderService,
    private authService: AuthService,
    private rateService: RateService,
    private transactionService: TransactionService,
    private walletCustodialService: WalletCustodialService,
  ) {}

  async intiatePaymentRequestToMerchant(
    merchantId: Types.ObjectId,
    opts: InitiateMerchantPMTParams,
  ) {
    if (opts.newTransaction === "true") {
      // Usually in SDKs
      // No transaction was initiated beforehand, therefore this will create merchant transaction and offramp transaction and assign the offramp transaction to the merchant
      throw new InternalServerErrorException("Not yet implemented.");
    }

    // A transaction without offramping has already been created (because we could not tell what payment method they wanted to use). We initiate the payment based on the payment type
    // Initiate an offramping transaction

    const {
      bankDetails,
      countryCode,
      coinToReceive,
      amountToSend,
      origin,
      type,
      rateId,
      walletUsed,
      merchantTransaction,
      fromAddr,
    } = opts;

    const initiatedOfframpTxn =
      await this.transactionService.initiateOfframpTransaction({
        userId: merchantId,
        recipient: {
          bankCode: bankDetails.code,
          acctName: bankDetails.ownerName,
          acctNo: bankDetails.number,
          type,
          countryCode,
        },
        amountToSend,
        asset: {
          asset: coinToReceive.asset,
          chain: coinToReceive.assetChain,
          amount: coinToReceive.amount,
        },
        fromAddr: fromAddr ?? "",
        paymentOrigin: origin,
        requiresMFA: false,
        rates: {
          internal: { rateId }, // Reference to our rate
        },
        walletUsed,
      });

    merchantTransaction.offrampId = initiatedOfframpTxn._id as Types.ObjectId;
    initiatedOfframpTxn.status = PaymentTransactionStatus.AUTHORIZED;

    await merchantTransaction.save();
    await initiatedOfframpTxn.save();

    if (walletUsed === "external") return initiatedOfframpTxn;

    // Initiate withdrawal for internal transactions
    // What should be returned?
    throw new InternalServerErrorException("Not yet implemented.");
  }

  // Normal routes for users using the app (internal transaction)
  async processPayment(sessionToken: string) {
    // Decode the payment token and ensure that it is valid
    const { reference } =
      await this.authService.verifyPaymentSession(sessionToken);

    const result = await this.paymentRailService.processPayment(reference);
    return result;
  }

  // We use this for anonymous customer workflow (Provided there is the offramping transaction reference)
  async processPaymentUsingReference(reference: string) {
    const result = await this.paymentRailService.processPayment(reference);
    return result;
  }

  async initiatePaymentRequest(
    params: PaymentTxnParams,
    countryCode: CountryCode,
    payment: {
      type: "merchant" | "external";
      origin: PaymentOrigin;
      walletUsed: "internal" | "external";
    },
    userId: Types.ObjectId,
  ) {
    if (payment.walletUsed === "internal" && !userId)
      throw new InternalServerErrorException(
        "Internal wallet is being used. Please pass a user identification.",
      );
    // Recording the intent to send money

    // 3) Change transaction state to created
    // 4) The transaction by default needs pin access, but we have to verify the risk status (money-size e.t.c) and determine if MFA is required or we should block the transaction entirely if risk status failed
    // Return transaction and security requirements like pin and mfa

    // Note transaction information (sender, recipient bank details e.t.c)
    const { bankDetails, amountToSend, coinToReceive } = params;

    //  VALIDATIONS
    // 1) Ensure amount is > 0
    try {
      const numericalAmount = Number(amountToSend.amount);
      if (!(numericalAmount > 0))
        throw new BadRequestException("Amount must be greater than 0.");
    } catch (err) {
      throw new BadRequestException(
        "Amount passed is not a valid numerical value.",
      );
    }

    // 2) !!! CHECK FOR KYC, (**AML LIMITS**) AND PAYOUT ELIGIBILLITY (DO THEY HAVE THE AMOUNT - FOR INTERNAL WALLETS)

    // Ensure that bank details checks out
    const isBankDetailsValid = await this.paymentRailService.verifyBankDetails(
      countryCode,
      bankDetails.number,
      bankDetails.code,
      bankDetails.ownerName,
    );

    if (!isBankDetailsValid)
      throw new BadRequestException("Account details credentials invalid");

    // 3) is the asset to be sent supported by our liquidity provider(s)?
    const supportedAsset = this.supportedAssetsForPayment({
      chain: coinToReceive.assetChain,
      asset: coinToReceive.asset,
    });

    if (!supportedAsset)
      throw new BadRequestException(
        "This asset is not supported by the platform.",
      );

    // 4) Perform risk assessment to know if MFA is required
    const riskAssessment = await this.authService.riskAssessment();
    let requiresMFA = true;

    if (riskAssessment === "block")
      throw new BadRequestException(
        "This transaction has a high risk score and has been blocked.",
      );
    else if (riskAssessment === "allow") requiresMFA = false;

    // Process the fiat equivalent for the transaction
    const rate = await this.rateService.getCurrentRates();

    const cryptoAmountToPay = await this.rateService.convertAssets(
      amountToSend.amount,
      { from: amountToSend.currency, to: coinToReceive.asset },
    );

    // Initiate the transaction
    const initiatedTransaction =
      await this.transactionService.initiateOfframpTransaction({
        userId,
        recipient: {
          bankCode: bankDetails.code,
          acctName: bankDetails.ownerName,
          acctNo: bankDetails.number,
          type: payment.type,
          countryCode,
        },
        amountToSend,
        asset: {
          asset: coinToReceive.asset,
          chain: coinToReceive.assetChain,
          amount: cryptoAmountToPay,
        },
        fromAddr: "",
        paymentOrigin: payment.origin,
        requiresMFA,
        rates: {
          internal: { rateId: rate._id as Types.ObjectId }, // Reference to our rate
        },
        walletUsed: payment.walletUsed,
      });

    let coinWithdrawalResult:
      | Awaited<
          ReturnType<
            typeof this.walletCustodialService.initiateAssetTransferTransaction
          >
        >
      | undefined = undefined;

    if (payment.walletUsed === "internal") {
      // Also initiate a coin withdrawal session
      coinWithdrawalResult =
        await this.walletCustodialService.initiateAssetTransferTransaction(
          {
            recipient: {
              type: "address",
              address: "platform",
            },
            amount: cryptoAmountToPay,
            chain: coinToReceive.assetChain,
            assetName: coinToReceive.asset,
            userId: userId as Types.ObjectId,
            offrampTxnId: initiatedTransaction._id as Types.ObjectId,
          },
          "regular",
        );

      // Update the coin amount and add gas fee

      initiatedTransaction.assetSent.amount = coinWithdrawalResult.amount.total;
      await initiatedTransaction.save();
    }

    // Generate a payment token that the client will present when they want to process this transaction
    const paymentToken = await this.authService.createPaymentSession({
      userId: "", // Generate a random character of strings
      metadata: { reference: initiatedTransaction.transactionReference },
    });

    return {
      message:
        "Your payment has been initiated. This transactiin will expire in 15mins.",
      coinToExchange: {
        amount: initiatedTransaction.assetSent.amount,
        asset: initiatedTransaction.assetSent.asset,
        chain: initiatedTransaction.assetSent.chain,
      },
      fiatAmount: amountToSend.amount,
      ...securityChecks(requiresMFA),
      paymentToken,
    };
  }

  supportedAssetsForPayment(coinAsset: { chain: string; asset: string }) {
    return this.liquidityProviderService.supportAsset(
      coinAsset.chain + "." + coinAsset.asset,
    );
  }
}

import { BadRequestException, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { AddressMonitoringService } from "src/address-monitoring/address-monitoring.service";
import { AvailableWalletChains } from "src/common/types/wallet-custody";
import { CurrencyCode } from "src/liquidity-provider/providers/yellow-card/types";
import { MerchantPaymentType } from "src/models/merchant-transaction.entitiy";
import { PaymentService } from "src/payment/payment.service";
import { RateService } from "src/rate/rate.service";
import { TransactionService } from "src/transaction/transaction.service";
import ExternalWalletAddressUtil from "src/utils/virtual-wallet-address";

@Injectable()
export class MerchantSdkService {
  constructor(
    private paymentService: PaymentService,
    private rateService: RateService,
    private externalWalletAddrUtil: ExternalWalletAddressUtil,
    private addressMonitoringService: AddressMonitoringService,
    private transactionService: TransactionService,
  ) {}

  async initatePaymentWithExternalWlt(
    merchantId: Types.ObjectId,
    amount: string,
    currency: CurrencyCode,
    coinAsset: {
      chain: AvailableWalletChains;
      asset: string;
    },
  ) {
    // Validations
    // 1) Ensure amount is > 0

    try {
      const numericalAmount = Number(amount);
      if (!(numericalAmount > 0))
        throw new BadRequestException("Amount must be greater than 0.");
    } catch (err) {
      throw new BadRequestException(
        "Amount passed is not a valid numerical value.",
      );
    }

    // Ensure that the asset is supported for offramping
    const supportedAsset =
      this.paymentService.supportedAssetsForPayment(coinAsset);

    if (!supportedAsset)
      throw new BadRequestException(
        "This asset is not supported by the platform.",
      );

    // Process the fiat equivalent for the transaction
    const rate = await this.rateService.getCurrentRates();
    const cryptoAmountToPay = await this.rateService.convertAssets(amount, {
      from: currency,
      to: coinAsset.asset,
    });

    // --- Externally --- //
    // Generate an external address for it
    const walletForExternalTransaction =
      await this.externalWalletAddrUtil.generateExternalAddress(
        {
          chain: coinAsset.chain,
          asset: coinAsset.asset,
          amount: cryptoAmountToPay,
        },
        "merchant",
      );

    // Monitor webhook for events
    await this.addressMonitoringService.updateAddressesToMonitor(
      [walletForExternalTransaction.address],
      "add",
      coinAsset.chain,
    );

    // Create intent to recieve payment
    const merchantTransaction =
      await this.transactionService.initiateMerchantTransaction(
        merchantId,
        {
          currency,
          amount,
        },
        {
          ...coinAsset,
          amount: cryptoAmountToPay,
        },
        {
          external: walletForExternalTransaction.address,
        },
        {
          transactionType: MerchantPaymentType.SDK_EXTERNAL,
          exchangeRate: rate._id as Types.ObjectId,
        },
      );

    const { reference, paymentMethod } = merchantTransaction;
    return {
      reference,
      amount,
      coinEquivalent: {
        cryptoAmountToPay,
        ...coinAsset,
      },
      ...(paymentMethod.internal && {
        internalPaymentId: paymentMethod.internal,
      }),
      ...(paymentMethod.external && {
        transferToAddress: paymentMethod.external,
      }),
    };
  }
}

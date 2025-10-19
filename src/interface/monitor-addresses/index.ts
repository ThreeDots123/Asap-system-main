import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { AddressMonitoringProcessorType } from "src/common/types/address-monitoring";
import { AvailableWalletChains } from "src/common/types/wallet-custody";
import { MerchantService } from "src/merchant/merchant.service";
import { PaymentOrigin } from "src/models/offramp-transaction";
import { PaymentService } from "src/payment/payment.service";
import { TransactionService } from "src/transaction/transaction.service";
import ExternalWalletAddressUtil from "src/utils/virtual-wallet-address";
import { WalletService } from "src/wallet/wallet.service";

@Injectable()
export abstract class AbstractAddressMonitoringProcessor {
  constructor(
    private baseWalletService: WalletService,
    private baseExternalWalletAddrUtil: ExternalWalletAddressUtil,
    private baseTransactionService: TransactionService,
    private basePaymentService: PaymentService,
    private baseMerchantService: MerchantService,
  ) {}
  async addAddressesForMonitoring(
    addresses: string[],
    chain: AvailableWalletChains,
  ) {
    await this.processAddAddressesToMonitor(addresses, chain);
  }

  async removeAddressesFromMonitoring(
    addresses: string[],
    chain: AvailableWalletChains,
  ) {
    await this.processStopMonitoringForAddresses(addresses, chain);
  }

  async handleAddressActivityEvent(address: string) {
    // Get that address from our database
    const foundAddressWlt =
      await this.baseWalletService.retrieveSingleExternalWalletAddress(address);

    if (!foundAddressWlt) return;

    const balance = await this.baseExternalWalletAddrUtil.walletAddressBalance(
      foundAddressWlt.chain,
      address,
    );

    if (balance >= foundAddressWlt.amount) {
      if (foundAddressWlt.usedFor === "merchant") {
        // Get merchant transaction
        // Initiate offramp transaction if not yet initiated else process offramp
        const merchantTxn =
          await this.baseTransactionService.retrieveMerchantTransactionByAddress(
            foundAddressWlt.address,
          );

        if (!merchantTxn) return;

        let offrampTxnReference: string;
        if (!merchantTxn.offrampId) {
          const merchant = await this.baseMerchantService.findById(
            merchantTxn.merchantId.toString(),
          );

          if (!merchant) return;

          offrampTxnReference =
            await this.basePaymentService.intiatePaymentRequestToMerchant(
              merchantTxn.merchantId,
              {
                newTransaction: "false",
                type: "merchant",
                origin: PaymentOrigin.EXTERNAL,
                rateId: merchantTxn.exchangeRate,
                walletUsed: "external",
                merchantTransaction: merchantTxn,
                bankDetails: {
                  code: merchant.settlementAccount.bank,
                  number: merchant.settlementAccount.accountNumber,
                  ownerName: merchant.settlementAccount.accountName,
                }, // Get it from merchant details
                coinToReceive: {
                  asset: merchantTxn.coinAsset.asset,
                  assetChain: merchantTxn.coinAsset.chain,
                  amount: merchantTxn.coinAsset.amount,
                },
                amountToSend: {
                  currency: merchantTxn.currency,
                  amount: merchantTxn.amount,
                },
                countryCode: "NG",
              },
            );
        } else {
          // Get offramp transaction using the offramp id and then assign it
          const offrampTxn =
            await this.baseTransactionService.retrieveOfframpTransactionById(
              merchantTxn.offrampId,
            );

          if (!offrampTxn) return;

          offrampTxnReference = offrampTxn.transactionReference;
        }

        // Process offramping and payout
        await this.basePaymentService.processPaymentUsingReference(
          offrampTxnReference,
        );

        this.baseWalletService.updateExternalWalletToSettled(
          foundAddressWlt.address,
        );
      }

      // Handle External Send process...
    }

    return;
  }

  /**
   * Provider-specific implementation to get provider ID
   */
  public abstract getProviderId():
    | Promise<AddressMonitoringProcessorType>
    | AddressMonitoringProcessorType;

  protected abstract processAddAddressesToMonitor(
    addresses: string[],
    chain?: AvailableWalletChains,
  ): Promise<void>;
  protected abstract processStopMonitoringForAddresses(
    addresses: string[],
    chain?: AvailableWalletChains,
  ): Promise<void>;
}

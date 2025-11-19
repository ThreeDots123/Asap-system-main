import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { AddressMonitoringProcessorType } from "src/common/types/address-monitoring";
import { AvailableWalletChains } from "src/common/types/wallet-custody";
import { MerchantService } from "src/merchant/merchant.service";
import { AccountOrigin, AccountType } from "src/models/ledger/entry.entity";
import {
  OfframpTransactionDocument,
  PaymentOrigin,
} from "src/models/offramp-transaction";
import { PaymentService } from "src/payment/payment.service";
import { TransactionService } from "src/transaction/transaction.service";
import ExternalWalletAddressUtil from "src/utils/virtual-wallet-address";
import { WalletService } from "src/wallet/wallet.service";
import { LedgerService } from "src/ledger/ledger.service";

@Injectable()
export abstract class AbstractAddressMonitoringProcessor {
  constructor(
    private baseWalletService: WalletService,
    private baseExternalWalletAddrUtil: ExternalWalletAddressUtil,
    private baseTransactionService: TransactionService,
    private basePaymentService: PaymentService,
    private baseMerchantService: MerchantService,
    private baseLedgerService: LedgerService,
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

  async handleAddressActivityEvent(address: string, addrSentFrom: string) {
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

        let offrampTransaction: OfframpTransactionDocument;
        if (!merchantTxn.offrampId) {
          const merchant = await this.baseMerchantService.findById(
            merchantTxn.merchantId.toString(),
          );

          if (!merchant) return;

          offrampTransaction =
            await this.basePaymentService.intiatePaymentRequestToMerchant(
              merchantTxn.merchantId,
              {
                newTransaction: "false",
                type: "merchant",
                origin: PaymentOrigin.EXTERNAL,
                rateId: merchantTxn.exchangeRate,
                walletUsed: "external",
                merchantTransaction: merchantTxn,
                fromAddr: addrSentFrom,
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
          const retrievedOfframpTransaction =
            await this.baseTransactionService.retrieveOfframpTransactionById(
              merchantTxn.offrampId,
            );

          if (!retrievedOfframpTransaction) return;

          offrampTransaction = retrievedOfframpTransaction;
        }

        // Process offramping and payout
        await this.basePaymentService.processPaymentUsingReference(
          offrampTransaction.transactionReference,
        );

        this.baseWalletService.updateExternalWalletToSettled(
          foundAddressWlt.address,
        );

        // Record ledger entry for merchant payment received
        await this.baseLedgerService.recordBulkTransactionEntries(
          [
            // Debit -> Platform hot wallet (Crypto asset increase) - Crypto received from customer
            {
              type: "debit",
              amount: merchantTxn.coinAsset.amount,
              accountId: "nil",
              accountOrigin: AccountOrigin.PLATFORM,
              accountType: AccountType.ASSET,
              representation: "+" + merchantTxn.coinAsset.amount,
              metadata: {
                chain: merchantTxn.coinAsset.chain,
                asset: merchantTxn.coinAsset.asset,
                note: "Platform hot wallet increased - merchant received crypto payment",
                fromAddress: addrSentFrom,
                toAddress: address,
              },
            },
            // Credit -> Merchant liability (Amount owed to merchant)
            {
              type: "credit",
              amount: merchantTxn.amount,
              accountId: merchantTxn.merchantId as Types.ObjectId,
              accountOrigin: AccountOrigin.MERCHANT,
              accountType: AccountType.LIABILITY,
              representation: "+" + merchantTxn.amount,
              metadata: {
                currency: merchantTxn.currency,
                chain: merchantTxn.coinAsset.chain,
                asset: merchantTxn.coinAsset.asset,
                coinAmount: merchantTxn.coinAsset.amount,
                note: "Merchant liability increased - payment received from customer",
                transactionReference: merchantTxn.reference,
              },
            },
          ],
          offrampTransaction._id as Types.ObjectId,
          `Merchant payment received - ${merchantTxn.reference}`,
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

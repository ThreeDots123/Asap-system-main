# Ledger Entries Analysis Report

## ✅ Already Implemented (With Ledger Entries)

The following transaction flows already have ledger entries documented:

1. **Coin Deposit (Wallet Custody)**
   - Location: `src/interface/wallet-custody/abstract-custody.ts` - `handleDepositWebhookEvent()` (lines 906-942)
   - Records: User wallet credit (liability increase) + Platform hot wallet debit (asset increase)

2. **Coin Withdrawal (Wallet Custody)**
   - Location: `src/interface/wallet-custody/abstract-custody.ts` - `transferAssetToDestinstion()` for external withdrawals (lines 623-686)
   - Records: User wallet debit (liability decrease) + Fee collection + Platform hot wallet credit (asset decrease)
   - Webhook handler: `handleWithdrawalWebhookEvent()` (lines 752-768) records gas fee

3. **Internal Transfers (User-to-User)**
   - Location: `src/interface/wallet-custody/abstract-custody.ts` - `transferAssetToDestinstion()` for internal transfers (lines 497-560)
   - Records: User A debit + User B credit + Fee collection

4. **Internal Transfer to Platform (for Offramping)**
   - Location: `src/interface/wallet-custody/abstract-custody.ts` - `transferAssetToDestinstion()` when recipient is "platform" (lines 398-458)
   - Records: User wallet debit + Platform hot wallet credit + Fee collection

5. **Deposit Sweep Event**
   - Location: `src/interface/wallet-custody/abstract-custody.ts` - `handleDepositSweptEvent()` (lines 980-1019)
   - Records: Sweep entry + Gas fee for sweep

---

## ❌ Missing Ledger Entries

The following transaction flows are missing ledger entries and need to be implemented:

### 1. **Liquidity Provider Payout Initiation**

- **Location**: `src/interface/liquidity-provider/abstract-provider.ts` - `payoutToCustomer()` (lines 36-71)
- **Current State**: Comment on line 67-68 says "Save transaction entry to ledger money debited from platform hot wallet (No here tho)"
- **What's Missing**:
  - Debit: Platform hot wallet (asset decrease) - amount being sent to customer
  - Credit: Platform liability account (when payout is initiated)
- **Transaction Reference**: Available via `details.reference`
- **Note**: This happens when liquidity provider processes fiat payout to customer

**Ledger Entry Code:**

```typescript
// Add import at top of file
import { LedgerService } from "src/ledger/ledger.service";
import { AccountOrigin, AccountType } from "src/models/ledger/entry.entity";
import { OfframpTransactionDocument } from "src/models/offramp-transaction";

// Add to constructor
constructor(
  private baseTransactionService: TransactionService,
  private baseSocketGateway: SocketGateway,
  private baseLedgerService: LedgerService, // Add this
) {}

// In payoutToCustomer() method, after line 65 (after result.success check)
if (!result.success) throw new BadRequestException(result.error);

// Get the offramp transaction to use its ID for ledger
const offrampTransaction =
  await this.baseTransactionService.retrieveOfframpTransactionByReference(
    details.reference,
  );

if (offrampTransaction) {
  // Record ledger entry for payout initiation
  await this.baseLedgerService.recordBulkTransactionEntries(
    [
      // Debit -> Platform hot wallet (Fiat asset decrease) - Amount being sent to customer
      {
        type: "debit",
        amount: details.amount,
        accountId: "nil",
        accountOrigin: AccountOrigin.PLATFORM,
        accountType: AccountType.ASSET,
        representation: "-" + details.amount,
        metadata: {
          currency: details.country, // Country code represents currency
          processedBy: this.providerId,
          note: "Platform hot wallet debited for fiat payout to customer",
          recipientAccount: details.accountNumber,
          recipientBank: details.bankCode,
        },
      },
      // Credit -> Platform liability (Amount owed to customer being paid out)
      {
        type: "credit",
        amount: details.amount,
        accountId: "nil",
        accountOrigin: AccountOrigin.PLATFORM,
        accountType: AccountType.LIABILITY,
        representation: "-" + details.amount,
        metadata: {
          currency: details.country,
          processedBy: this.providerId,
          note: "Platform liability reduced - customer payout initiated",
          transactionReference: details.reference,
        },
      },
    ],
    offrampTransaction._id as Types.ObjectId,
    `Fiat payout initiation to customer - ${details.reference}`,
  );
}

return result.result;
```

### 2. **Liquidity Provider Payout Webhook (Completion/Failure)**

- **Location**: `src/interface/liquidity-provider/abstract-provider.ts` - `handlePayoutWebhookEvent()` (lines 73-147)
- **Current State**: Updates transaction status but no ledger entries
- **What's Missing**:
  - When status is `COMPLETED`: Close ledger entry, record final settlement
  - When status is `FAILED`: Record reversal entries (credit platform hot wallet back)
- **Transaction Reference**: Available via `transactionReference` parameter
- **Offramp Transaction**: Available via `transaction` variable

**Ledger Entry Code:**

```typescript
// In handlePayoutWebhookEvent() method, after line 90 (after transaction.status update)
transaction.status = response.status;

// Handle ledger entries based on payout status
if (response.status === PaymentTransactionStatus.COMPLETED) {
  // Record completion entry and close ledger
  await this.baseLedgerService.recordTransactionEntry(
    {
      type: "nil", // No balance change, just status update
      amount: transaction.sentAmount.amount,
      accountId: "nil",
      accountOrigin: AccountOrigin.PLATFORM,
      accountType: AccountType.ASSET,
      representation: "N/A",
      metadata: {
        note: "Payout completed successfully - customer received funds",
        processedBy: this.providerId,
        currency: transaction.sentAmount.currency,
        transactionReference: transactionReference,
      },
    },
    transaction._id as Types.ObjectId,
  );

  // Close the ledger entry
  await this.baseLedgerService.closeLedgerEntry(
    transaction._id as Types.ObjectId,
  );
} else if (response.status === PaymentTransactionStatus.FAILED) {
  // Record reversal entries for failed payout
  await this.baseLedgerService.recordBulkTransactionEntries(
    [
      // Credit -> Platform hot wallet (Reverse the debit - refund fiat back)
      {
        type: "credit",
        amount: transaction.sentAmount.amount,
        accountId: "nil",
        accountOrigin: AccountOrigin.PLATFORM,
        accountType: AccountType.ASSET,
        representation: "+" + transaction.sentAmount.amount,
        metadata: {
          currency: transaction.sentAmount.currency,
          processedBy: this.providerId,
          note: "Platform hot wallet credited - payout failed, funds returned",
          transactionReference: transactionReference,
        },
      },
      // Debit -> Platform liability (Reverse the credit - customer still owed)
      {
        type: "debit",
        amount: transaction.sentAmount.amount,
        accountId: "nil",
        accountOrigin: AccountOrigin.PLATFORM,
        accountType: AccountType.LIABILITY,
        representation: "+" + transaction.sentAmount.amount,
        metadata: {
          currency: transaction.sentAmount.currency,
          processedBy: this.providerId,
          note: "Platform liability increased - payout failed, customer still owed",
          transactionReference: transactionReference,
        },
      },
    ],
    transaction._id as Types.ObjectId,
    `Payout failure reversal - ${transactionReference}`,
  );

  // Close the ledger entry
  await this.baseLedgerService.closeLedgerEntry(
    transaction._id as Types.ObjectId,
  );
}

// Check if this offramp transaction is attached to a merchant's payment transaction
```

### 3. **Offramp Transaction Funded Event**

- **Location**: `src/event/subscribers/offramp/transaction.subscriber.ts` - `handleOfframpFunded()` (lines 23-80)
- **Current State**: Processes payout but no ledger entry for the funding event
- **What's Missing**:
  - Record that offramp transaction is now funded and ready for payout
  - This is the transition from FUNDED status to processing payout
- **Transaction Reference**: Available via `offrampTransaction.transactionReference`
- **Note**: This event is emitted after withdrawal webhook confirms the coin withdrawal

**Ledger Entry Code:**

```typescript
// Add imports at top of file
import { LedgerService } from "src/ledger/ledger.service";
import { AccountOrigin, AccountType } from "src/models/ledger/entry.entity";

// Update constructor
constructor(
  private liquidityProviderService: LiquidityProviderService,
  private baseLedgerService: LedgerService, // Add this
) {}

// In handleOfframpFunded() method, after line 37 (after logger.log)
this.logger.log("Offramp transaction funded for, ", transactionReference);

// Record ledger entry for funded status
await this.baseLedgerService.recordTransactionEntry(
  {
    type: "nil", // Status update, no balance change
    amount: amount,
    accountId: "nil",
    accountOrigin: AccountOrigin.PLATFORM,
    accountType: AccountType.ASSET,
    representation: "N/A",
    metadata: {
      chain,
      asset,
      note: "Offramp transaction funded - crypto received and ready for fiat payout",
      transactionReference,
      status: "FUNDED",
    },
  },
  offrampTransaction._id as Types.ObjectId,
);

// Get the liquidity provider with the cheapest rate
```

### 4. **Merchant Transaction Creation (Payment Received)**

- **Location**: `src/interface/monitor-addresses/index.ts` - `handleAddressActivityEvent()` (lines 35-114)
- **Current State**: When external wallet receives payment, merchant transaction is created/updated but no ledger entry
- **What's Missing**:
  - When merchant receives crypto payment:
    - Debit: Platform hot wallet (asset increase) - crypto received
    - Credit: Merchant liability account (amount owed to merchant)
- **Transaction Reference**: Available via `merchantTxn.reference`
- **Note**: This happens when customer sends crypto to merchant's external wallet address

**Ledger Entry Code:**

```typescript
// Add imports at top of file
import { LedgerService } from "src/ledger/ledger.service";
import { AccountOrigin, AccountType } from "src/models/ledger/entry.entity";
import { Types } from "mongoose";

// Update constructor
constructor(
  private baseWalletService: WalletService,
  private baseExternalWalletAddrUtil: ExternalWalletAddressUtil,
  private baseTransactionService: TransactionService,
  private basePaymentService: PaymentService,
  private baseMerchantService: MerchantService,
  private baseLedgerService: LedgerService, // Add this
) {}

// In handleAddressActivityEvent() method, after line 56 (after merchantTxn check)
if (!merchantTxn) return;

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
  merchantTxn._id as Types.ObjectId,
  `Merchant payment received - ${merchantTxn.reference}`,
);

let offrampTxnReference: string;
```

### 5. **Merchant Transaction Completion**

- **Location**: `src/interface/liquidity-provider/abstract-provider.ts` - `handlePayoutWebhookEvent()` (lines 98-144)
- **Current State**: When merchant transaction status changes to `COMPLETED`, no ledger entry
- **What's Missing**:
  - When `merchantTxn.status = MerchantTransactionStatus.COMPLETED`:
    - Record that merchant payment is fully settled
    - Close any open ledger entries for this merchant transaction
- **Transaction Reference**: Available via `merchantTxn.reference`

**Ledger Entry Code:**

````typescript
// In handlePayoutWebhookEvent() method, inside the COMPLETED case (after line 105)
case PaymentTransactionStatus.COMPLETED: {
  merchantTxn.status = MerchantTransactionStatus.COMPLETED;

  // Record ledger entry for merchant transaction completion
  await this.baseLedgerService.recordBulkTransactionEntries(
    [
      // Debit -> Merchant liability (Reduce liability - merchant has been paid)
      {
        type: "debit",
        amount: merchantTxn.amount,
        accountId: merchantTxn.merchantId as Types.ObjectId,
        accountOrigin: AccountOrigin.MERCHANT,
        accountType: AccountType.LIABILITY,
        representation: "-" + merchantTxn.amount,
        metadata: {
          currency: merchantTxn.currency,
          chain: chain,
          asset: asset,
          coinAmount: coinAmount,
          note: "Merchant liability reduced - settlement completed, merchant paid",
          transactionReference: merchantTxn.reference,
          payoutReference: transaction.transactionReference,
        },
      },
      // Credit -> Platform fiat account (Fiat sent to merchant's bank account)
      {
        type: "credit",
        amount: merchantTxn.amount,
        accountId: "nil",
        accountOrigin: AccountOrigin.PLATFORM,
        accountType: AccountType.ASSET,
        representation: "-" + merchantTxn.amount,
        metadata: {
          currency: merchantTxn.currency,
          processedBy: this.providerId,
          note: "Platform fiat account debited - merchant settlement completed",
          transactionReference: merchantTxn.reference,
        },
      },
    ],
    merchantTxn._id as Types.ObjectId,
    `Merchant transaction settlement completed - ${merchantTxn.reference}`,
  );

  // Close the ledger entry for merchant transaction
  await this.baseLedgerService.closeLedgerEntry(
    merchantTxn._id as Types.ObjectId,
  );

  const {
    amount,
    currency,
    coinAsset: { asset, chain, amount: coinAmount },
  } = merchantTxn;

  // Flow state is completed and send socket event to merchant
  ```

### 6. **Payment Processing (Payment Rail Service)**
- **Location**: `src/payment-rail/payment-rail.service.ts` - `processPayment()` (lines 31-74)
- **Current State**: Processes payment but no ledger entry
- **What's Missing**:
  - When payment is processed via `offrampService.initiate()`:
    - Record the payment processing event
    - This is the bridge between payment initiation and actual payout
- **Transaction Reference**: Available via `reference` parameter

**Ledger Entry Code:**
```typescript
// Add imports at top of file
import { LedgerService } from "src/ledger/ledger.service";
import { AccountOrigin, AccountType } from "src/models/ledger/entry.entity";

// Update constructor
constructor(
  private configService: ConfigService,
  private transactionService: TransactionService,
  private offrampService: OfframpService,
  private ledgerService: LedgerService, // Add this
) {}

// In processPayment() method, after line 40 (after transaction validation)
if (!transaction)
  throw new BadRequestException(
    "This transaction was not found or is not authorised.",
  );

// Record ledger entry for payment processing initiation
await this.ledgerService.recordTransactionEntry(
  {
    type: "nil", // Status update, no balance change
    amount: transaction.sentAmount.amount,
    accountId: "nil",
    accountOrigin: AccountOrigin.PLATFORM,
    accountType: AccountType.ASSET,
    representation: "N/A",
    metadata: {
      note: "Payment processing initiated - offramp transaction being processed",
      transactionReference: reference,
      status: "PROCESSING",
      walletUsed: transaction.metadata.walletUsed,
    },
  },
  transaction._id as Types.ObjectId,
);

const {
  metadata: { walletUsed },
} = transaction;
````

### 7. **Onramp Transactions** (Future Implementation)

- **Location**: `src/onramp/onramp.service.ts`
- **Current State**: Service is empty (not yet implemented)
- **What Will Be Needed**:
  - When user purchases crypto with fiat:
    - Debit: Platform fiat account (or liquidity provider balance)
    - Credit: User wallet (liability increase)
    - Record exchange rate and fees
- **Note**: This is a placeholder for future implementation

**Ledger Entry Code (Future Implementation):**

```typescript
// Example structure for when onramp is implemented
// Add imports
import { LedgerService } from "src/ledger/ledger.service";
import { AccountOrigin, AccountType } from "src/models/ledger/entry.entity";
import { Types } from "mongoose";

// In onramp processing method (when implemented)
await this.baseLedgerService.recordBulkTransactionEntries(
  [
    // Debit -> Platform fiat account (Fiat received from user)
    {
      type: "debit",
      amount: fiatAmount,
      accountId: "nil",
      accountOrigin: AccountOrigin.PLATFORM,
      accountType: AccountType.ASSET,
      representation: "+" + fiatAmount,
      metadata: {
        currency: fiatCurrency,
        note: "Platform fiat account increased - user purchased crypto",
        transactionReference: onrampTransaction.reference,
      },
    },
    // Credit -> User wallet (Crypto liability increase)
    {
      type: "credit",
      amount: cryptoAmount,
      accountId: userWalletChain._id as Types.ObjectId,
      accountOrigin: AccountOrigin.USER,
      accountType: AccountType.LIABILITY,
      representation: "+" + cryptoAmount,
      metadata: {
        chain,
        asset,
        exchangeRate: rate,
        note: "User wallet credited - crypto purchased with fiat",
        transactionReference: onrampTransaction.reference,
      },
    },
    // Debit -> Platform revenue (Fee collected from user)
    {
      type: "debit",
      amount: feeAmount,
      accountId: "nil",
      accountOrigin: AccountOrigin.PLATFORM,
      accountType: AccountType.REVENUE,
      representation: "+" + feeAmount,
      metadata: {
        note: "Platform revenue increased - onramp fee collected",
        transactionReference: onrampTransaction.reference,
      },
    },
  ],
  onrampTransaction._id as Types.ObjectId,
  `Onramp transaction - user purchased ${cryptoAmount} ${asset} with ${fiatAmount} ${fiatCurrency}`,
);

// Close ledger when transaction completes
await this.baseLedgerService.closeLedgerEntry(
  onrampTransaction._id as Types.ObjectId,
);
```

### 8. **Merchant Transaction via Internal Wallet** (If Implemented)

- **Location**: `src/payment/payment.service.ts` - `intiatePaymentRequestToMerchant()` (lines 37-100)
- **Current State**: Line 99 says "Not yet implemented" for internal wallet merchant payments
- **What Will Be Needed** (when implemented):
  - When merchant receives payment via internal wallet:
    - Debit: Customer wallet (liability decrease)
    - Credit: Merchant wallet/liability (amount owed to merchant)
    - Record fees if applicable

**Ledger Entry Code (Future Implementation):**

```typescript
// Example structure for when internal wallet merchant payments are implemented
// Add imports
import { LedgerService } from "src/ledger/ledger.service";
import { AccountOrigin, AccountType } from "src/models/ledger/entry.entity";
import { Types } from "mongoose";

// In internal wallet merchant payment processing (when implemented)
// After customer wallet is debited and merchant transaction is created
await this.baseLedgerService.recordBulkTransactionEntries(
  [
    // Debit -> Customer wallet (Liability decrease) - Customer paid merchant
    {
      type: "debit",
      amount: merchantTxn.coinAsset.amount,
      accountId: customerWalletChain._id as Types.ObjectId,
      accountOrigin: AccountOrigin.USER,
      accountType: AccountType.LIABILITY,
      representation: "-" + merchantTxn.coinAsset.amount,
      metadata: {
        chain: merchantTxn.coinAsset.chain,
        asset: merchantTxn.coinAsset.asset,
        note: "Customer wallet debited - payment to merchant",
        transactionReference: merchantTxn.reference,
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
        note: "Merchant liability increased - received payment from customer",
        transactionReference: merchantTxn.reference,
      },
    },
    // Debit -> Platform revenue (Fee collected, if applicable)
    {
      type: "debit",
      amount: feeAmount, // If fees are charged
      accountId: "nil",
      accountOrigin: AccountOrigin.PLATFORM,
      accountType: AccountType.REVENUE,
      representation: "+" + feeAmount,
      metadata: {
        note: "Platform revenue increased - merchant payment processing fee",
        transactionReference: merchantTxn.reference,
      },
    },
  ],
  merchantTxn._id as Types.ObjectId,
  `Internal wallet merchant payment - ${merchantTxn.reference}`,
);

// Close ledger when transaction completes
await this.baseLedgerService.closeLedgerEntry(
  merchantTxn._id as Types.ObjectId,
);
```

---

## 📋 Summary

**Total Missing Ledger Entries: 8 locations**

1. ✅ Liquidity Provider Payout Initiation
2. ✅ Liquidity Provider Payout Webhook (Completion/Failure)
3. ✅ Offramp Transaction Funded Event
4. ✅ Merchant Transaction Creation (Payment Received)
5. ✅ Merchant Transaction Completion
6. ✅ Payment Processing (Payment Rail Service)
7. ⚠️ Onramp Transactions (Future)
8. ⚠️ Merchant Internal Wallet Payments (Future)

---

## 🔍 Key Files to Modify

1. `src/interface/liquidity-provider/abstract-provider.ts` - Lines 36-71, 73-147
2. `src/event/subscribers/offramp/transaction.subscriber.ts` - Lines 23-80
3. `src/interface/monitor-addresses/index.ts` - Lines 35-114
4. `src/payment-rail/payment-rail.service.ts` - Lines 31-74
5. `src/onramp/onramp.service.ts` - (Future implementation)

---

## 💡 Implementation Pattern

Based on existing implementations, ledger entries should follow this pattern:

```typescript
await this.baseLedgerService.recordBulkTransactionEntries(
  [
    {
      type: "debit" | "credit",
      amount: string,
      accountId: Types.ObjectId | "nil",
      accountOrigin: AccountOrigin.USER | AccountOrigin.PLATFORM,
      accountType:
        AccountType.LIABILITY | AccountType.ASSET | AccountType.EXPENSE,
      representation: "+" | ("-" + amount),
      metadata: {
        // Transaction details, notes, etc.
      },
    },
    // ... more entries
  ],
  transactionId as Types.ObjectId,
  "Memo/Description of transaction",
);

// Close ledger when transaction is complete
await this.baseLedgerService.closeLedgerEntry(transactionId);
```

---

## 📝 Notes

- All ledger entries should be double-entry (debits = credits)
- Use `AccountOrigin.USER` for user-related accounts
- Use `AccountOrigin.PLATFORM` for platform/hot wallet accounts
- Use `AccountType.LIABILITY` for user balances (money we owe users)
- Use `AccountType.ASSET` for platform crypto holdings
- Use `AccountType.EXPENSE` for fees and costs
- Always close ledger entries when transactions are completed
- Handle failed transactions with reversal entries

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomBytes } from "crypto";
import { CountryCode } from "libphonenumber-js";
import { Model, Types } from "mongoose";
import { LiquidityProviderProcessorType } from "src/common/types/liquidity-provider";
import {
  AvailableWalletChains,
  ProcessorType,
  UserType,
} from "src/common/types/wallet-custody";
import {
  PaymentOrigin,
  PaymentTransactionStatus,
  OfframpTransaction,
  OfframpTransactionDocument,
} from "src/models/offramp-transaction";
import {
  MerchantPaymentType,
  MerchantTransaction,
  MerchantTransactionDocument,
  MerchantTransactionStatus,
} from "src/models/merchant-transaction.entitiy";
import { UserDocument } from "src/models/user.entity";
import {
  Transaction,
  TransactionDocument,
  TransactionStatus,
  TransactionType,
} from "src/models/wallet/transaction.entity";
import { AuthoriseTransactionDto } from "src/wallet/dto/authorise-transaction.dto";

@Injectable()
export class TransactionService {
  constructor(
    @InjectModel(Transaction.name)
    private transactionModel: Model<Transaction>,
    @InjectModel(OfframpTransaction.name)
    private offrampTransactionModel: Model<OfframpTransaction>,
    @InjectModel(MerchantTransaction.name)
    private merchantTransactionModel: Model<MerchantTransaction>,
  ) {}
  async initiateP2PTransferTransaction(data: {
    from: string;
    to: string;
    amount: {
      subAmount: string;
      fee: string;
      total: string;
    };
    chain: string;
    asset: string;
    internalTxn:
      | {
          status: false;
        }
      | {
          status: true;
          recipient: Types.ObjectId;
        };
    comment?: string;
    userId: Types.ObjectId;
    gasFee:
      | {}
      | {
          amount: string;
          asset: string;
        };
    action: "received" | "sent";
    offrampTxnId?: Types.ObjectId;
    userType: UserType;
  }): Promise<TransactionDocument> {
    // Initiate transactions specific for peer to peer transaction (sending coin | receiving coin from others)
    const { from, to, amount, chain, asset, action, gasFee, comment, userId } =
      data;

    return new this.transactionModel({
      fromAddr: from,
      toAddr: to,
      txnHash: "nil",
      blockNo: "nil",
      amount,
      chain,
      userId,
      asset,
      gasFee,
      canHandleInternally: data.internalTxn,
      transactionReference: this.generateTransactionReference("WDR"),
      ...(data.offrampTxnId && { offrampTxnId: data.offrampTxnId }),
      custodialTxnId: "nil",
      processedBy: ProcessorType.NONE,
      type: TransactionType.P2P_TRANSFER,
      securityChecks: {
        pinVerified: false,
      },
      metadata: {
        createdBy: ProcessorType.NONE,
        userType: data.userType,
        custom: {
          transactionMode: action,
          ...(comment && { comment }),
        },
      },
    }).save();
  }

  async recordDepositTransaction(data: {
    from: string;
    to: string;
    amount: string;
    chain: AvailableWalletChains;
    asset: string;
    hash: string;
    processor: ProcessorType;
    custodialTxnId: string;
    blockNo: string;
    userId: Types.ObjectId;
    userType: UserType;
    reference: string;
  }) {
    const {
      userType,
      from,
      to,
      asset,
      amount,
      chain,
      custodialTxnId,
      processor,
      hash,
      userId,
      reference,
    } = data;

    return new this.transactionModel({
      status: TransactionStatus.COMPLETED,
      fromAddr: from,
      toAddr: to,
      txnHash: hash,
      transactionReference: reference,
      userId,
      chain,
      asset,
      canHandleInternally: false, // If it was true, we wouldn't be receiving a webhook.
      amount: {
        subAmount: amount,
        total: amount,
        fee: "0",
      },
      processedBy: processor,
      type: TransactionType.P2P_TRANSFER,
      custodialTxnId,
      metadata: {
        userType,
        custom: {
          transactionMode: "received",
        },
      },
    }).save();
  }

  async authoriseP2PTransaction(
    reference: string,
    user: UserDocument,
    body: AuthoriseTransactionDto,
  ) {
    const { pin } = body;

    const transaction = await this.retrieveInitiatedTransaction(
      reference,
      TransactionType.P2P_TRANSFER,
    );

    if (!transaction)
      throw new NotFoundException(
        "No transaction was found. Cannot authorise.",
      );

    const { securityChecks } = transaction;

    if (!securityChecks) {
      transaction.status === TransactionStatus.AUTHORIZED;
      await transaction.save();

      return {
        message: "Your transaction has been authorised.",
        requiresMfa: false,
        reference,
      };
    } else {
      const { pinVerified, mfaVerified } = securityChecks;

      if (pinVerified !== undefined) {
        // Verify Pin
        if (!pin)
          throw new BadRequestException(
            "This transaction requires a user pin.",
          );

        const isValid = await user.comparePin(pin);

        if (isValid) {
          const requiresMFA = mfaVerified !== undefined ? !mfaVerified : false;

          // @ts-ignore
          transaction.securityChecks.pinVerified = true;

          if (!requiresMFA) {
            transaction.status = TransactionStatus.AUTHORIZED;
          }

          await transaction.save();

          return {
            message: requiresMFA
              ? "Pin authorisation successful."
              : "Your transaction has been authorised.",
            requiresMFA,
            reference,
          };
        }

        throw new BadRequestException("Invalid transaction pin.");
      }

      return {
        message: "Your transaction has been authorised.",
        requiresMfa: false,
        reference,
      };
    }
  }

  async retrieveInitiatedTransaction(
    reference: string,
    transactionType: TransactionType,
  ): Promise<TransactionDocument | null> {
    return this.transactionModel.findOne({
      transactionReference: reference,
      type: transactionType,
      expiresAt: { $gt: new Date() },
      status: TransactionStatus.INITIATED,
    });
  }

  // Retrieves payment that have a status of authorized (Authorized indicates that the user have passed the authorization requirements of that transaction like pin and mfa)
  async retrieveAuthorizedTransaction(
    reference: string,
    transactionType: TransactionType,
  ): Promise<TransactionDocument | null> {
    return this.transactionModel.findOne({
      transactionReference: reference,
      type: transactionType,
      expiresAt: { $gt: new Date() },
      status: { $ne: TransactionStatus.INITIATED },
    });
  }

  async retrieveTransactionByHash(
    hash: string,
    transactionType: TransactionType,
  ): Promise<TransactionDocument | null> {
    return this.transactionModel.findOne({
      type: transactionType,
      // status: { $ne: TransactionStatus.INITIATED },
      txnHash: hash,
    });
  }

  async retrieveTransactionByReference(
    reference: string,
    transactionType: TransactionType,
  ): Promise<TransactionDocument | null> {
    return this.transactionModel.findOne({
      type: transactionType,
      // status: { $ne: TransactionStatus.INITIATED },
      transactionReference: reference,
    });
  }

  async initiateOfframpTransaction(data: {
    userId: Types.ObjectId;
    recipient: {
      bankCode: string;
      acctName: string;
      acctNo: string;
      countryCode: CountryCode;
      type: "merchant" | "external";
    };
    asset: {
      chain: string;
      asset: string;
      amount: string;
    };
    fromAddr: string;
    amountToSend: {
      currency: string;
      amount: string;
    };
    paymentOrigin: PaymentOrigin;
    requiresMFA: boolean;
    rates: {
      internal: { rateId: Types.ObjectId };
      provider?: {
        name: LiquidityProviderProcessorType;
        rate: Record<string, string>;
      };
    };
    walletUsed: "internal" | "external";
  }): Promise<OfframpTransactionDocument> {
    return new this.offrampTransactionModel({
      recipient: data.recipient,
      fromAddr: data.fromAddr,
      assetSent: data.asset,
      sentAmount: data.amountToSend,
      transactionReference: this.generateTransactionReference("PMT"),
      origin: data.paymentOrigin,
      securityChecks: {
        pinVerified: false,
        ...(data.requiresMFA && { mfaVerified: false }),
      },
      userId: data.userId,
      processedBy: ProcessorType.NONE,
      exchangeRate: {
        internal: { rates: data.rates.internal.rateId },
        ...(data.rates.provider && { provider: data.rates.provider }),
      },
      metadata: {
        walletUsed: data.walletUsed,
      },
    }).save();
  }

  async initiateMerchantTransaction(
    merchantId: Types.ObjectId,
    amountToAccept: {
      currency: string;
      amount: string;
    },
    asset: {
      chain: string;
      asset: string;
      amount: string;
    },
    paymentMethod: {
      internal?: string;
      external?: string;
    },
    opts: {
      transactionType: MerchantPaymentType;
      metadata?: Record<string, string>;
      exchangeRate?: Types.ObjectId;
      offrampId?: Types.ObjectId;
    },
  ): Promise<MerchantTransactionDocument> {
    return new this.merchantTransactionModel({
      merchantId,
      reference: this.generateTransactionReference(
        opts.transactionType === MerchantPaymentType.POS ? "POS" : "SDK",
      ),
      amount: amountToAccept.amount,
      currency: amountToAccept.currency,
      paymentMethod,
      coinAsset: asset,
      paymentType: opts.transactionType,
      ...(opts.exchangeRate && { exchangeRate: opts.exchangeRate }),
      ...(opts.offrampId && { offrampId: opts.offrampId }),
      ...(opts.metadata && { metadata: opts.metadata }),
    }).save();
  }

  async retrieveMerchantTransactionByAddress(
    address: string,
  ): Promise<MerchantTransactionDocument | null> {
    return this.merchantTransactionModel.findOne({
      "paymentMethod.external": address,
    });
  }

  async retrieveInitiatedOfframpTransaction(
    reference: string,
  ): Promise<OfframpTransactionDocument | null> {
    return this.offrampTransactionModel.findOne({
      transactionReference: reference,
      status: PaymentTransactionStatus.INITIATED,
      expiresAt: { $gt: new Date() },
    });
  }

  async retrieveInitiatedOfframpCoinWithdrawalTransaction(
    offrampTxnId: Types.ObjectId,
  ): Promise<TransactionDocument | null> {
    return this.transactionModel.findOne({
      type: TransactionType.P2P_TRANSFER,
      status: TransactionStatus.INITIATED,
      offrampTxnId,
    });
  }

  async retrieveOfframpCoinWithdrawalTransaction(
    offrampTxnId: Types.ObjectId,
  ): Promise<TransactionDocument | null> {
    return this.transactionModel.findOne({
      type: TransactionType.P2P_TRANSFER,
      status: { $ne: TransactionStatus.INITIATED },
      offrampTxnId,
    });
  }

  async retrieveOfframpTransactionById(
    txnId: Types.ObjectId,
  ): Promise<OfframpTransactionDocument | null> {
    return this.offrampTransactionModel.findOne({
      status: { $ne: TransactionStatus.INITIATED },
      _id: txnId,
    });
  }

  async retrieveOfframpTransactionByReference(
    reference: string,
  ): Promise<OfframpTransactionDocument | null> {
    return this.offrampTransactionModel.findOne({
      status: { $ne: TransactionStatus.INITIATED },
      transactionReference: reference,
    });
  }

  async retrieveAuthorizedOfframpTransaction(
    reference: string,
    status?: PaymentTransactionStatus,
  ): Promise<OfframpTransactionDocument | null> {
    if (status && status === PaymentTransactionStatus.INITIATED)
      throw new InternalServerErrorException(
        "Cannot provide an initiated transaction. Transaction should be authorised.",
      );
    return this.offrampTransactionModel.findOne({
      transactionReference: reference,
      status: status ? status : PaymentTransactionStatus.AUTHORIZED,
      expiresAt: { $gt: new Date() },
    });
  }

  async retieveAllMerchantTransactions(
    merchantId: Types.ObjectId,
    query?: { page?: number; limit?: number; status?: string },
  ) {
    const { page = 1, limit = 20, status } = query || {};
    const filter: any = { merchantId };
    if (status) filter.status = status;

    const [transactions, total] = await Promise.all([
      this.merchantTransactionModel
        .find(filter)
        // .select("amount currency status createdAt reference") // summary fields only
        .sort({ createdAt: -1 })
        .populate("merchantId", "fullname email businessName")
        .populate("exchangeRate", "rates")
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.transactionModel.countDocuments(filter),
    ]);

    return {
      total,
      page,
      limit,
      data: transactions,
    };
  }

  async retrieveMerchantProcessedPaymentAmt(merchantId: Types.ObjectId) {
    const total = await this.merchantTransactionModel.aggregate([
      {
        $match: {
          merchantId: new Types.ObjectId(merchantId),
          status: MerchantTransactionStatus.COMPLETED, // only count successfully processed ones
        },
      },
      {
        $group: {
          _id: "$merchantId",
          totalAmount: { $sum: { $toDouble: "$amount" } },
          count: { $sum: 1 },
        },
      },
    ]);

    if (total.length === 0) return 0;

    return total[0].totalAmount;
  }

  async retrieveMerchantPosTransactions(
    merchantId: Types.ObjectId,
    query?: { page?: number; limit?: number; status?: string },
  ) {
    const { page = 1, limit = 20, status } = query || {};
    const filter: any = { merchantId, paymentType: MerchantPaymentType.POS };
    if (status) filter.status = status;

    const [transactions, total] = await Promise.all([
      this.merchantTransactionModel
        .find(filter)
        .select("amount currency status createdAt reference") // summary fields only
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.transactionModel.countDocuments(filter),
    ]);

    return {
      total,
      page,
      limit,
      data: transactions,
    };
  }

  async retrieveMerchantTransactionDetails(
    merchantId: Types.ObjectId,
    reference: string,
  ) {
    const query = {
      merchantId,
      reference,
    };

    const transaction = await this.merchantTransactionModel
      .findOne(query)
      .select("-paymentMethod -createdAt -updatedAt")
      .populate("merchantId", "fullname email businessName")
      .populate("exchangeRate", "rates")
      .lean();

    if (!transaction) {
      throw new NotFoundException("Transaction not found");
    }

    return transaction;
  }

  async retrieveMerchantPosProcessedPaymentAmt(merchantId: Types.ObjectId) {
    const total = await this.merchantTransactionModel.aggregate([
      {
        $match: {
          merchantId: new Types.ObjectId(merchantId),
          status: MerchantTransactionStatus.COMPLETED, // only count successfully processed ones
          paymentType: MerchantPaymentType.POS,
        },
      },
      {
        $group: {
          _id: "$merchantId",
          totalAmount: { $sum: { $toDouble: "$amount" } },
          count: { $sum: 1 },
        },
      },
    ]);

    if (total.length === 0) return 0;

    return total[0].totalAmount;
  }

  async retrieveMerchantTransactionByOfframId(
    offrampId: Types.ObjectId,
  ): Promise<MerchantTransactionDocument | null> {
    return this.merchantTransactionModel.findOne({ offrampId });
  }

  private generateTransactionReference(prefix: string, length: number = 8) {
    // Validate prefix to ensure it's clean
    if (!/^[A-Z0-9]+$/i.test(prefix)) {
      throw new Error("Prefix must be alphanumeric.");
    }

    // Create a high-precision, sortable timestamp (YYYYMMDDHHMMSS)
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;

    // 3. Generate a cryptographically secure random string
    // Each byte becomes 2 hex characters, so we need half the desired length in bytes.
    const randomByteLength = Math.ceil(length / 2);
    const randomPart = randomBytes(randomByteLength)
      .toString("hex")
      .slice(0, length);

    return `${prefix.toUpperCase()}_${timestamp}_${randomPart}`;
  }
}

import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomBytes } from "crypto";
import { Model, Types } from "mongoose";
import {
  AccountOrigin,
  AccountType,
  LedgerEntry,
  LedgerStatus,
} from "src/models/ledger/entry.entity";

interface TransactionEntry {
  type: "debit" | "credit" | "nil";
  amount: string;
  accountId: Types.ObjectId | "nil";
  accountOrigin: AccountOrigin;
  accountType: AccountType;
  metadata?: Record<string, string>;
  representation: string;
}

@Injectable()
export class LedgerService {
  constructor(
    @InjectModel(LedgerEntry.name) private ledgerEntryModel: Model<LedgerEntry>,
  ) {}

  private async openLedgerEntry(ledgerTxn: {
    memo?: string;
    transactionId: Types.ObjectId;
  }) {
    const { transactionId, memo } = ledgerTxn;
    const idempotencyKey =
      transactionId.toString() + randomBytes(16).toString("hex");
    return this.ledgerEntryModel.create({
      idempotencyKey,
      transactionId,
      ...(memo && { memo }),
    });
  }

  async recordTransactionEntry(
    entry: TransactionEntry,
    transactionId: Types.ObjectId,
    memo?: string,
  ) {
    let ledger = await this.ledgerEntryModel.findOne({ transactionId });
    if (!ledger) {
      ledger = await this.openLedgerEntry({ transactionId, memo });
    } else if (ledger.status === LedgerStatus.POSTED) return ledger;

    // Ensures that the entry is not already in the ledger
    const { type, accountId, accountOrigin, amount, accountType, metadata } =
      entry;
    try {
      await this.ledgerEntryModel.updateOne(
        { _id: ledger._id },
        {
          $addToSet: {
            entries: {
              entryKey: `${accountOrigin}:${type}:${accountId}:${amount}`,
              accountId,
              debit: type === "debit",
              credit: type === "credit",
              accountOrigin,
              type: accountType,
              representation: entry.representation,
              amount,
              ...(metadata && { metadata }),
            },
          },
        },
      );
    } catch (err) {
      throw new InternalServerErrorException(
        "Something happened during ledger recording",
      );
    }
  }

  async recordBulkTransactionEntries(
    entries: Array<TransactionEntry>,
    transactionId: Types.ObjectId,
    memo?: string,
  ) {
    let ledger = await this.ledgerEntryModel.findOne({ transactionId });
    if (!ledger) {
      ledger = await this.openLedgerEntry({ transactionId, memo });
    } else if (ledger.status === LedgerStatus.POSTED) return ledger;

    try {
      // Pre-compute entry keys
      const entriesWithKeys = entries.map((entry) => ({
        entryKey: `${entry.accountOrigin}:${entry.type}:${entry.accountId}:${entry.amount}`,
        accountId: entry.accountId,
        debit: entry.type === "debit",
        credit: entry.type === "credit",
        accountOrigin: entry.accountOrigin,
        type: entry.accountType,
        representation: entry.representation,
        amount: entry.amount,
        ...(entry.metadata && { metadata: entry.metadata }),
      }));

      // Use $addToSet + $each for deduplication
      await this.ledgerEntryModel.updateOne(
        { _id: ledger._id },
        {
          $addToSet: {
            entries: { $each: entriesWithKeys },
          },
        },
      );

      // Return updated ledger
      return await this.ledgerEntryModel.findById(ledger._id);
    } catch (err) {
      throw new InternalServerErrorException(
        "Something happened during bulk ledger recording",
      );
    }
  }

  async closeLedgerEntry(transactionId: Types.ObjectId) {
    const ledger = await this.ledgerEntryModel.findOne({ transactionId });
    if (!ledger) return;

    ledger.status = LedgerStatus.POSTED;
    return ledger.save();
  }
}

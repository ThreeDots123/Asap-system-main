import { Module } from "@nestjs/common";
import { TransactionService } from "./transaction.service";
import { MongooseModule } from "@nestjs/mongoose";
import TransactionSchema, {
  Transaction,
} from "src/models/wallet/transaction.entity";
import OfframpTransactionSchema, {
  OfframpTransaction,
} from "src/models/offramp-transaction";
import MerchantTransactionSchema, {
  MerchantTransaction,
} from "src/models/merchant-transaction.entitiy";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: OfframpTransaction.name, schema: OfframpTransactionSchema },
      { name: MerchantTransaction.name, schema: MerchantTransactionSchema },
    ]),
  ],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}

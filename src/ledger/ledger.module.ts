import { Module } from "@nestjs/common";
import { LedgerService } from "./ledger.service";
import LedgerEntrySchema, { LedgerEntry } from "src/models/ledger/entry.entity";
import { MongooseModule } from "@nestjs/mongoose";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
    ]),
  ],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}

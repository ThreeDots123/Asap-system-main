import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import applicationAccounts from "./account-template";
import { PlatformAccount } from "src/models/platform-account.entity";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";

// Manages Platforms activities
@Injectable()
export class AsapService implements OnModuleInit {
  private readonly logger = new Logger(AsapService.name);
  private platformAccountsMap: Map<string, string> = new Map();

  constructor(
    @InjectModel(PlatformAccount.name)
    private platformAccountModel: Model<PlatformAccount>,
  ) {}

  async onModuleInit() {
    // Create accounts if accounts do not exist
    await Promise.all(
      applicationAccounts.map(async ({ name, balance, currency }) => {
        try {
          await this.createAccount(name, currency, balance);
          this.logger.log("Added account " + name);
        } catch (err) {
          // Ignore error.. Mainly occured because the recored exist.
        }
      }),
    );
  }

  createAccount(
    name: string,
    currency: string,
    balance: Types.Decimal128 | Record<string, Types.Decimal128>,
  ) {
    return new this.platformAccountModel({
      name,
      currency,
      balance,
    }).save();
  }
}

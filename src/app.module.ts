import { MiddlewareConsumer, Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { getDatabaseConfig } from "./config/database.config";
import { LoggerMiddleware } from "./middleware/request-logger.middleware";
import { UserModule } from "./user/user.module";
import { MerchantModule } from "./merchant/merchant.module";
import { PaymentRailModule } from "./payment-rail/payment-rails.module";
import { AuthModule } from "./auth/auth.module";
import { TokenModule } from "./token/token.module";
import { RedisModule } from "./redis/redis.module";
import { MemoryStoreModule } from "./memory-store/memory-store.module";
import { SmsModule } from "./sms/sms.module";
import { AccountModule } from "./account/account.module";
import { EventModule } from "./event/event.module";
import { WalletModule } from "./wallet/wallet.module";
import { WalletCustodialModule } from "./wallet-custodial/wallet-custodial.module";
import { GatewayModule } from "./gateway/gateway.module";
import { TransactionModule } from "./transaction/transaction.module";
import { PaymentModule } from "./payment/payment.module";
import { LedgerModule } from "./ledger/ledger.module";
import { AsapModule } from "./asap/asap.module";
import { OfframpModule } from "./offramp/offramp.module";
import { OnrampModule } from "./onramp/onramp.module";
import { LiquidityProviderModule } from "./liquidity-provider/liquidity-provider.module";
import { WebhookModule } from "./webhook/webhook.module";
import { RateModule } from "./rate/rate.module";
import { SendModule } from "./send/send.module";
import { MerchantPosModule } from './merchant-pos/merchant-pos.module';
import { UtilsModule } from './utils/utils.module';
import { AddressMonitoringModule } from './address-monitoring/address-monitoring.module';
import { EmailModule } from './email/email.module';
import { MerchantSdkModule } from './merchant-sdk/merchant-sdk.module';
import { BankModule } from './bank/bank.module';
import { KycModule } from './kyc/kyc.module';

@Module({
  imports: [
    // Registering the env file to the config service
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    // Initialize database using mongoose
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    UserModule,
    MerchantModule,
    PaymentRailModule,
    AuthModule,
    TokenModule,
    RedisModule,
    MemoryStoreModule,
    SmsModule,
    AccountModule,
    EventModule,
    WalletModule,
    WalletCustodialModule,
    GatewayModule,
    TransactionModule,
    PaymentModule,
    LedgerModule,
    AsapModule,
    OfframpModule,
    OnrampModule,
    LiquidityProviderModule,
    WebhookModule,
    RateModule,
    SendModule,
    MerchantPosModule,
    UtilsModule,
    AddressMonitoringModule,
    EmailModule,
    MerchantSdkModule,
    BankModule,
    KycModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }
}

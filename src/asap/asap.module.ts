import { Module } from "@nestjs/common";
import { AsapService } from "./asap.service";
import { MongooseModule } from "@nestjs/mongoose";
import PlatformAccountSchema, {
  PlatformAccount,
} from "src/models/platform-account.entity";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PlatformAccount.name, schema: PlatformAccountSchema },
    ]),
  ],
  providers: [AsapService],
})
export class AsapModule {}

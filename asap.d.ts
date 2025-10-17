import { Merchant } from "src/models/merchant.entity";
import { User } from "src/models/user.entity";

//* Extended request
export declare module "@types/express/index" {
  declare interface Request {
    user?: Partial<User>;
    merchant?: Partial<Merchant>;
  }
}

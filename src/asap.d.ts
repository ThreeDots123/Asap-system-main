import { Merchant } from "src/models/merchant.entity";
import { User } from "src/models/user.entity";

//* Extended request
declare global {
  namespace Express {
    declare interface Request {
      user?: Partial<User>;
      merchant?: Partial<Merchant>;
    }
  }
}

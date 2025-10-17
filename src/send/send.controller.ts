import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  Headers,
  UseGuards,
} from "@nestjs/common";
import { Types } from "mongoose";
import { Request } from "express";
import { AuthorisePaymentDto } from "./dto/authorise-payment.dto";
import { PaymentSessionHeaderDto } from "./dto/payment-header.dto";
import { OfframpDetailsDto } from "./dto/initiate-payment.dto";
import { PaymentOrigin } from "src/models/offramp-transaction";
import { VerifiedUserWithMFA } from "src/auth/guards/user-with-mfa.guard";
import { UserDocument } from "src/models/user.entity";
import { SendService } from "./send.service";

@Controller("send")
export class SendController {
  constructor(private sendService: SendService) {}

  @Post("initiate")
  @UseGuards(VerifiedUserWithMFA)
  async initiatePaymentSession(
    @Req() request: Request,
    @Body() _body: OfframpDetailsDto,
  ) {
    const { _id } = request.user as UserDocument;

    const { coin, country, currency, walletUsed, origin, bank, amount } = _body;

    if (origin !== PaymentOrigin.EXTERNAL && origin !== PaymentOrigin.INTERNAL)
      throw new BadRequestException(
        "Payment origin should either be, " +
          PaymentOrigin.EXTERNAL +
          " or " +
          PaymentOrigin.INTERNAL,
      );

    if (walletUsed === "external" && origin === PaymentOrigin.INTERNAL)
      throw new BadRequestException(
        "walletUsed and payment origin cannot conflict.. external and Dedicated_wallet does not overlap",
      );
    else if (walletUsed === "internal" && origin === PaymentOrigin.EXTERNAL)
      throw new BadRequestException(
        "walletUsed and payment origin cannot conflict.. internal and External_wallet does not overlap",
      );

    const result = this.sendService.initiateSendToRecipient(
      _id as Types.ObjectId,
      {
        countryCode: country,
        walletUsed,
        origin,
        amount,
        currency,
        bank,
        coin,
      },
    );

    return result;
  }

  @Post("authorise/pin")
  @UseGuards(VerifiedUserWithMFA)
  async authorisePaymentSession(
    @Req() request: Request,
    @Body() _body: AuthorisePaymentDto,
    @Headers() header: PaymentSessionHeaderDto,
  ) {
    if (!header["x-payment-session"])
      throw new BadRequestException("x-payment-session expected in header.");

    const session = header["x-payment-session"];

    // Authorise payment session using the user's pin
    const user = request.user as UserDocument;

    const result = await this.sendService.authoriseSendSession(
      session,
      user,
      _body.pin,
    );

    return result;
  }

  @Post("complete")
  @UseGuards(VerifiedUserWithMFA)
  async completeSendTransaction(@Headers() header: PaymentSessionHeaderDto) {
    if (!header["x-payment-session"])
      throw new BadRequestException("x-payment-session expected in header.");

    const session = header["x-payment-session"];
    const result = await this.sendService.processSend(session);
    return result;
  }
}

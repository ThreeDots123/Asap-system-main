import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { MerchantSDKGuard } from "src/auth/guards/merchant/sdk-merchant.guard";
import { InitiatePaymentWithExternalWltDto } from "./dto/initiate-payment-external-wlt.dto";
import { MerchantDocument } from "src/models/merchant.entity";
import { MerchantSdkService } from "./merchant-sdk.service";
import { Types } from "mongoose";

@Controller("merchant/sdk")
export class MerchantSdkController {
  constructor(private merchantSdkService: MerchantSdkService) {}
  @Post("payment/initiate/external")
  @UseGuards(MerchantSDKGuard)
  async initiatePaymentForExternalWlt(
    @Req() request: Request,
    @Body() _body: InitiatePaymentWithExternalWltDto,
  ) {
    const { _id } = request.merchant as MerchantDocument;
    const { coin, currency, amount } = _body;

    const result = await this.merchantSdkService.initatePaymentWithExternalWlt(
      _id as Types.ObjectId,
      amount,
      currency,
      coin,
    );

    return {
      message: "Transaction initiated successfully",
      ...result,
    };
  }
}

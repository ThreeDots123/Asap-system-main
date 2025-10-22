import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { MerchantSDKGuard } from "src/auth/guards/merchant/sdk-merchant.guard";
import { InitiatePaymentWithExternalWltDto } from "./dto/initiate-payment-external-wlt.dto";
import { MerchantDocument } from "src/models/merchant.entity";
import { MerchantSdkService } from "./merchant-sdk.service";
import { Types } from "mongoose";
import { TransactionService } from "src/transaction/transaction.service";

@Controller("merchant/sdk")
export class MerchantSdkController {
  constructor(
    private merchantSdkService: MerchantSdkService,
    private transactionService: TransactionService,
  ) {}
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

  @Get("transactions")
  @UseGuards(MerchantSDKGuard)
  async getAllMerchantTransactions(@Req() request: Request) {
    const { _id } = request.merchant as MerchantDocument;

    return this.transactionService.retieveAllMerchantTransactions(
      _id as Types.ObjectId,
    );
  }

  @Get("transactions/total")
  @UseGuards(MerchantSDKGuard)
  async getMerchantTotalTransaction(@Req() request: Request) {
    const { _id } = request.merchant as MerchantDocument;

    return this.transactionService.retrieveMerchantProcessedPaymentAmt(
      _id as Types.ObjectId,
    );
  }

  @Get("transactions/:reference")
  @UseGuards(MerchantSDKGuard)
  async retrieveSingleMerchantTransaction(
    @Req() request: Request,
    @Param("reference") reference: string,
  ) {
    const { _id } = request.merchant as MerchantDocument;
    return this.transactionService.retrieveMerchantTransactionDetails(
      _id as Types.ObjectId,
      reference,
    );
  }
}

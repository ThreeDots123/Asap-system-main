import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { VerifiedMerchant } from "src/auth/guards/merchant/verified-merchant.guard";
import { InitiatePaymentDto } from "./dto/initiate-pos-payment.dto";
import { MerchantDocument } from "src/models/merchant.entity";
import { MerchantPosService } from "src/merchant-pos/merchant-pos.service";
import { Types } from "mongoose";
import { MerchantWithSettlementAccountGuard } from "src/auth/guards/merchant/merchant-with-settlementAcct.guard";
import { UpdateMerchantDto } from "./dto/update-profile.dto";
import { MerchantService } from "./merchant.service";
import { TransactionService } from "src/transaction/transaction.service";

@Controller("merchant")
export class MerchantController {
  constructor(
    private merchantService: MerchantService,
    private merchantPosService: MerchantPosService,
    private transactionService: TransactionService,
  ) {}

  @Get("me")
  @UseGuards(VerifiedMerchant)
  async getMerchantProfile(@Req() request: Request) {
    const {
      businessName,
      email,
      settlementAccount,
      status,
      apiKey,
      secretKey,
      fullname,
    } = request.merchant as MerchantDocument;

    return {
      businessName,
      email,
      status,
      publicKey: apiKey,
      secretKey,
      fullname,
      ...(settlementAccount && { ...settlementAccount }),
    };
  }

  @Patch("me")
  @UseGuards(VerifiedMerchant)
  async updateProfile(
    @Body() _body: UpdateMerchantDto,
    @Req() request: Request,
  ) {
    const { id } = request.merchant as MerchantDocument;

    const {
      settlementAccount,
      websiteUrl: updatedWebsiteUrl,
      contactNumber: updatedContactInfo,
    } = _body;

    const updateOps = {};

    if (settlementAccount) {
      if (settlementAccount.accountName)
        updateOps["settlementAccount.accountName"] =
          settlementAccount.accountName;
      if (settlementAccount.accountNumber)
        updateOps["settlementAccount.accountNumber"] =
          settlementAccount.accountNumber;
      if (settlementAccount.bank)
        updateOps["settlementAccount.bank"] = settlementAccount.bank;
    }

    if (updatedWebsiteUrl) updateOps["websiteUrl"] = updatedWebsiteUrl;
    if (updatedContactInfo) updateOps["contactNumber"] = updatedContactInfo;

    const {
      businessName,
      email,
      status,
      apiKey,
      secretKey,
      contactNumber,
      websiteUrl,
      fullname,
    } = await this.merchantService.update(id, {
      $set: updateOps,
    });

    return {
      businessName,
      contactNumber,
      websiteUrl,
      fullname,
      email,
      status,
      publicKey: apiKey,
      secretKey,
      settlementAccount,
    };
  }

  @Post("pos/initiate")
  @UseGuards(MerchantWithSettlementAccountGuard)
  async intiatePOSTransaction(
    @Req() request: Request,
    @Body() _body: InitiatePaymentDto,
  ) {
    const { _id } = request.merchant as MerchantDocument;

    const { coin, currency, amount } = _body;

    const result = await this.merchantPosService.intitatePOSPayment(
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

  @Get("pos/transactions")
  @UseGuards(VerifiedMerchant)
  async retrieveMerchantTransactions(@Req() request: Request) {
    const { _id } = request.merchant as MerchantDocument;
    return this.transactionService.retrieveMerchantPosTransactions(
      _id as Types.ObjectId,
    );
  }

  @Get("pos/transactions/:reference")
  @UseGuards(VerifiedMerchant)
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

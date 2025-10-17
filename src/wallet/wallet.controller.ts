import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { VerifiedUser } from "src/auth/guards/verified-user.guard";
import { AddNewChainDto } from "./dto/add-new-chain.dto";
import { WalletCustodialService } from "src/wallet-custodial/wallet-custodial.service";
import { UserDocument } from "src/models/user.entity";
import { Request } from "express";
import { Types } from "mongoose";
import { AvailableWalletChains } from "src/common/types/wallet-custody";
import { WalletService } from "./wallet.service";
import { walletChainDetails } from "src/wallet-custodial/chain-details";
import { TransferAssetDto } from "./dto/transfer-asset.dto";
import { CountryCode } from "libphonenumber-js";
import { VerifiedUserWithMFA } from "src/auth/guards/user-with-mfa.guard";
import { AuthoriseTransactionDto } from "./dto/authorise-transaction.dto";
import { TransactionService } from "src/transaction/transaction.service";

@Controller("wallet")
@UseGuards(VerifiedUser)
export class WalletController {
  constructor(
    private walletCustodialService: WalletCustodialService,
    private walletService: WalletService,
    private transactionService: TransactionService,
  ) {}

  @Get("chains")
  @UseGuards(VerifiedUser)
  async retrieveAvailableChains() {
    const availableChains = Object.entries(AvailableWalletChains).map(
      ([, value]) => value,
    );

    return availableChains;
  }

  @Post("chain/user/new")
  @UseGuards(VerifiedUser)
  async addNewChain(@Body() _body: AddNewChainDto, @Req() request: Request) {
    const { _id, phone } = request.user as UserDocument;
    const { chainName: chain } = _body;

    const response = await this.walletCustodialService.assignWallet({
      userType: "regular",
      chain,
      metadata: { userId: _id as Types.ObjectId, phone },
    });

    if (!response)
      throw new BadRequestException(
        "User already own this chain network on his wallet.",
      );

    const { address } = response;

    return {
      chain,
      address,
      logo: walletChainDetails[chain].logoUrl,
    };
  }

  @Get("chains/user")
  @UseGuards(VerifiedUser)
  async retrieveWalletChains(@Req() request: Request) {
    const { _id } = request.user as UserDocument;

    // Fetch chains saved in database
    const chains = await this.walletService.findChainsById(
      _id as Types.ObjectId,
      "regular",
    );

    return {
      chains: chains.map((chain) => {
        const { chain: name, id, address } = chain;
        return {
          name,
          id,
          logo: walletChainDetails[name].logoUrl,
          address,
        };
      }),
    };
  }

  @Get("chain/user/:chain/balance")
  @UseGuards(VerifiedUser)
  async retrieveChainBalances(
    @Req() request: Request,
    @Param("chain") chain: AvailableWalletChains,
  ) {
    const { _id } = request.user as UserDocument;
    const response = await this.walletCustodialService.retrieveChainBalance({
      userId: _id as Types.ObjectId,
      userType: "regular",
      chain,
    });

    return response;
  }

  @Post("chain/user/:chain/:asset/transfer/initiate")
  @UseGuards(VerifiedUserWithMFA)
  async initiateChainAssetTransfer(
    @Param("chain") chain: AvailableWalletChains,
    @Param("asset") asset: string,
    @Req() request: Request,
    @Body() _body: TransferAssetDto,
  ) {
    const { _id } = request.user as UserDocument;
    const { recipient, amount, comment } = _body;

    // Process this initiation and pass an idempotency key to this user (Cookie)
    const result =
      await this.walletCustodialService.initiateAssetTransferTransaction(
        {
          amount,
          assetName: asset,
          chain,
          userId: _id as Types.ObjectId,
          recipient: {
            ...(recipient.phone
              ? {
                  phone: recipient.phone as string,
                  countryCode: recipient.country as CountryCode,
                  type: "phone",
                }
              : { address: recipient.address as string, type: "address" }),
          },
          comment,
        },
        "regular",
      );

    return result;
  }

  @Post("chain/user/:reference/transfer")
  @UseGuards(VerifiedUserWithMFA)
  async transferChainAsset(
    @Param("reference") reference: string,
    @Req() request: Request,
  ) {
    const { _id } = request.user as UserDocument;

    const result = await this.walletCustodialService.transferChainAsset(
      _id as Types.ObjectId,
      reference,
      "regular",
    );
    return result;
  }

  @Post("transaction/:reference/authorise/pin")
  @UseGuards(VerifiedUserWithMFA)
  async authoriseWithdrawalTransaction(
    @Param("reference") reference: string,
    @Req() request: Request,
    @Body() _body: AuthoriseTransactionDto,
  ) {
    const user = request.user as UserDocument;

    const result = await this.transactionService.authoriseP2PTransaction(
      reference,
      user,
      _body,
    );

    return result;
  }
}

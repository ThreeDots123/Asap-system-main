import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { ethers, HDNodeWallet } from "ethers";
import {
  AvailableWalletChains,
  ProcessorType,
  UserType,
} from "src/common/types/wallet-custody";
import {
  ChainAssetDetails,
  ChainAssetDocument,
  WalletType,
} from "src/models/wallet/chain-asset-details.entity";
import {
  MerchantWallet,
  MerchantWalletDocument,
} from "src/models/wallet/merchant-wallet.entity";
import {
  UserWallet,
  UserWalletDocument,
} from "src/models/wallet/user-wallet.entity";
import {
  ExternalWallet,
  ExternalWalletDocument,
  ExternalWalletStatus,
} from "src/models/wallet/external-wallet.entity";

@Injectable()
export class WalletService {
  constructor(
    @InjectModel(UserWallet.name) private userWalletModel: Model<UserWallet>,
    @InjectModel(MerchantWallet.name)
    private merchantWalletModel: Model<MerchantWallet>,
    @InjectModel(ChainAssetDetails.name)
    private chainAssetDetailsModel: Model<ChainAssetDetails>,
    @InjectModel(ExternalWallet.name)
    private externalWalletModel: Model<ExternalWallet>,
  ) {}
  async registerNewChain(
    userType: UserType,
    data: {
      userId: Types.ObjectId;
      chain: string;
      address: string;
      custodialId?: string;
      processedBy: ProcessorType;
    },
  ) {
    const { userId, chain, address, custodialId, processedBy } = data;
    const chainInfo = {
      ...(userType === "regular" ? { userId } : { merchantId: userId }),
      chain,
      address,
      processedBy,
      ...(custodialId && { custodialId }),
    };

    const newChain =
      userType === "regular"
        ? new this.userWalletModel(chainInfo)
        : new this.merchantWalletModel(chainInfo);

    return newChain.save();
  }

  // 1. Overload Signature for 'regular' userType
  async findWalletsByProcessor(
    user: { userType: "regular"; userId: string },
    processedBy: ProcessorType,
  ): Promise<UserWalletDocument[]>;

  // 2. Overload Signature for 'merchant' userType
  async findWalletsByProcessor(
    user: { userType: "merchant"; userId: string }, // Assuming merchantId is also called userId here for simplicity
    processedBy: ProcessorType,
  ): Promise<MerchantWalletDocument[]>;

  async findWalletsByProcessor(
    user: { userType: UserType; userId: string },
    processedBy: ProcessorType,
  ): Promise<(UserWalletDocument | MerchantWalletDocument)[]> {
    if (user.userType === "regular")
      return this.userWalletModel.find({ processedBy });
    else return this.merchantWalletModel.find({ processedBy });
  }

  async findUserWalletChains(
    userId: Types.ObjectId | string,
    userType: "regular",
  ): Promise<UserWalletDocument[]>;
  async findUserWalletChains(
    userId: Types.ObjectId | string,
    userType: "merchant",
  ): Promise<MerchantWalletDocument[]>;
  async findUserWalletChains(
    userId: Types.ObjectId | string,
    userType: UserType,
  ): Promise<(UserWalletDocument | MerchantWalletDocument)[]> {
    if (userType === "regular") return this.userWalletModel.find({ userId });
    return this.merchantWalletModel.find({ merchantId: userId });
  }

  // 1. Overload Signature for 'regular' userType
  async findWalletChainByName(
    user: { userType: "regular"; userId: string | Types.ObjectId },
    chain: AvailableWalletChains,
  ): Promise<UserWalletDocument | null>;

  // 2. Overload Signature for 'merchant' userType
  async findWalletChainByName(
    user: { userType: "merchant"; userId: string | Types.ObjectId }, // Assuming merchantId is also called userId here for simplicity
    chain: AvailableWalletChains,
  ): Promise<MerchantWalletDocument | null>;

  async findWalletChainByName(
    user: { userType: UserType; userId: string | Types.ObjectId },
    chain: AvailableWalletChains,
  ): Promise<(UserWalletDocument | null) | (MerchantWalletDocument | null)> {
    if (user.userType === "regular")
      return this.userWalletModel.findOne({ chain, userId: user.userId });
    else
      return this.merchantWalletModel.findOne({ chain, userId: user.userId });
  }

  // // 1. Overload Signature for 'regular' userType
  // async findWalletChainByNameWithAddress(
  //   user: { userType: "regular"; address: string },
  //   chain: AvailableWalletChains,
  // ): Promise<UserWalletDocument | null>;

  // // 2. Overload Signature for 'merchant' userType
  // async findWalletChainByNameWithAddress(
  //   user: { userType: "merchant"; address: string }, // Assuming merchantId is also called userId here for simplicity
  //   chain: AvailableWalletChains,
  // ): Promise<MerchantWalletDocument | null>;

  async findWalletChainByNameWithAddress(
    user: { userType: UserType; address: string },
    chain: AvailableWalletChains,
  ): Promise<(UserWalletDocument | null) | (MerchantWalletDocument | null)> {
    if (user.userType === "regular")
      return this.userWalletModel.findOne({ chain, address: user.address });
    else
      return this.merchantWalletModel.findOne({ chain, address: user.address });
  }

  async retrieveAssetsForChain(
    walletId: Types.ObjectId,
    walletModelType: WalletType,
  ) {
    return this.chainAssetDetailsModel.find({ walletId, walletModelType });
  }

  async retrieveAssetForChainByName(
    walletId: Types.ObjectId,
    walletModelType: WalletType,
    assetName: string,
  ) {
    return this.chainAssetDetailsModel.findOne({
      walletId,
      walletModelType,
      $or: [
        { name: assetName.toLowerCase() },
        { symbol: assetName.toLowerCase() },
      ],
    });
  }

  async findChainsById(
    id: Types.ObjectId,
    userType: "regular",
  ): Promise<UserWalletDocument[]>;
  async findChainsById(
    id: Types.ObjectId,
    userType: "merchant",
  ): Promise<MerchantWalletDocument[]>;
  async findChainsById(
    id: Types.ObjectId,
    userType: UserType,
  ): Promise<(UserWalletDocument | MerchantWalletDocument)[]> {
    if (userType === "regular")
      return this.userWalletModel.find({ userId: id });
    else return this.merchantWalletModel.find({ merchantId: id });
  }

  async createChainBalance(
    params: {
      name: string;
      balance: string;
      convertedBalance: string;
      logo: string;
      processedBy: ProcessorType;
      walletId: Types.ObjectId;
      walletModelType: WalletType;
    }[],
  ) {
    return this.chainAssetDetailsModel.create(params);
  }

  async updateChainBalance(
    params: {
      name: string;
      balance: string;
      convertedBalance: string;
      logo: string;
      symbol: string;
      processedBy: ProcessorType;
      walletId: Types.ObjectId;
      walletModelType: WalletType;
    }[],
  ) {
    const bulkOps = params.map((param) => {
      const {
        walletId,
        walletModelType,
        name,
        balance,
        logo,
        convertedBalance,
        processedBy,
        symbol,
      } = param;
      return {
        updateOne: {
          filter: {
            walletId,
            walletModelType,
            symbol,
          },
          update: {
            $set: {
              name,
              balance,
              convertedBalance,
              processedBy,
              logo,
            },
          },
          upsert: true, // insert if not exists
        },
      };
    });

    return this.chainAssetDetailsModel.bulkWrite(bulkOps);
  }

  async calculateWalletBalance(
    userAsset: ChainAssetDocument,
    assetDetails: {
      amount: string;
      calc: "add" | "subtract";
    },
    getRate?: (asset: string, currency: string) => Promise<number>,
  ) {
    if (userAsset.name === "ethereum") {
      const balance = ethers.parseEther(userAsset.balance || "0");
      const externalAmount = ethers.parseEther(assetDetails.amount || "0");

      const newBalance =
        assetDetails.calc === "add"
          ? balance + externalAmount
          : balance - externalAmount;

      userAsset.balance = ethers.formatEther(newBalance);
    } else {
      // For tokens like USDC (6 decimals)
      const balance = ethers.parseUnits(userAsset.balance || "0", 6);
      const externalAmount = ethers.parseUnits(assetDetails.amount || "0", 6);

      const newBalance =
        assetDetails.calc === "add"
          ? balance + externalAmount
          : balance - externalAmount;

      // 👇 Be sure to format with the same 6 decimals
      userAsset.balance = ethers.formatUnits(newBalance, 6);
    }

    await userAsset.save();

    // Get the converted balance of the asset
    if (getRate) {
      const rate = await getRate(userAsset.symbol, "usd");
      userAsset.convertedBalance = String(Number(userAsset.balance) * rate);
    }

    return userAsset;
  }

  async userTopsAnotherUserAssetBalance({
    from,
    to,
  }: {
    from: { asset: ChainAssetDocument; id: Types.ObjectId; amount: string };
    to: { asset: ChainAssetDocument; id: Types.ObjectId; amount: string };
  }) {
    const modifiedAssets = await Promise.all([
      (async () => {
        const modifiedAsset = await this.calculateWalletBalance(from.asset, {
          amount: from.amount,
          calc: "subtract",
        });

        return {
          asset: modifiedAsset,
          id: from.id,
        };
      })(),

      (async () => {
        const modifiedAsset = await this.calculateWalletBalance(to.asset, {
          amount: to.amount,
          calc: "add",
        });

        return {
          asset: modifiedAsset,
          id: to.id,
        };
      })(),
    ]);

    return modifiedAssets;
  }

  async createExternalWallet(details: {
    chain: AvailableWalletChains;
    asset: string;
    amount: string;
    wallet: HDNodeWallet;
    userType: UserType;
  }) {
    const { chain, amount, wallet, asset, userType } = details;

    return new this.externalWalletModel({
      chain,
      asset,
      amount,
      usedFor: userType,
      address: wallet.address,
      pubKey: wallet.publicKey,
      secKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase || "",
    }).save();
  }

  async updateExternalWalletToSettled(address: string) {
    await this.externalWalletModel.updateOne(
      {
        address,
      },
      { status: ExternalWalletStatus.SETTLED },
    );
  }

  async retrieveSingleExternalWalletAddress(
    address: string,
  ): Promise<ExternalWalletDocument | null> {
    return this.externalWalletModel.findOne({
      address,
      status: ExternalWalletStatus.CREATED,
    });
  }
}

// 0.000000000003

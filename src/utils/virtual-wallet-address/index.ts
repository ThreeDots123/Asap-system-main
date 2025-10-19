import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers, HDNodeWallet } from "ethers";
import {
  AvailableWalletChains,
  UserType,
} from "src/common/types/wallet-custody";
import { BASE_SEPOLIA_RPC_URL, ETH_SEPOLIA_RPC_URL } from "src/config/env/list";
import { BASE_USDC, ETH_USDC, UNISWAP_PAIR_ERC20_V2_ABI } from "./config";
import { WalletService } from "src/wallet/wallet.service";
import { ExternalWalletDocument } from "src/models/wallet/external-wallet.entity";

@Injectable()
export default class ExternalWalletAddressUtil {
  constructor(
    private configService: ConfigService,
    private walletService: WalletService,
  ) {}

  async generateExternalAddress(
    coin: {
      chain: AvailableWalletChains;
      asset: string;
      amount: string;
    },
    userType: UserType,
  ): Promise<ExternalWalletDocument> {
    const { chain, asset, amount } = coin;
    const provider = this.processProvider(chain);
    const wallet = ethers.Wallet.createRandom(provider);

    // Save wallet to the database with its credentials
    return this.walletService.createExternalWallet({
      chain,
      asset,
      amount,
      wallet,
      userType,
    });
  }

  async markExternalAddressAsSettled(address: string) {
    try {
      await this.walletService.updateExternalWalletToSettled(address);
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async walletAddressBalance(chain: AvailableWalletChains, address: string) {
    const provider = this.processProvider(chain);

    // 🪙 Ethereum → native ETH balance
    if (chain === AvailableWalletChains.ERC20) {
      const balance = await provider.getBalance(address);
      return ethers.formatUnits(balance, 18);
    }

    // 🚫 For non-Ethereum chains → tokenAddress is required
    const tokenAddress =
      chain === AvailableWalletChains.BASE ? BASE_USDC : ETH_USDC;
    const contract = new ethers.Contract(
      tokenAddress,
      UNISWAP_PAIR_ERC20_V2_ABI.abi,
      provider,
    );

    const [balance, decimals] = await Promise.all([
      contract.balanceOf(address),
      contract.decimals(),
    ]);
    console.log(balance, decimals);

    return ethers.formatUnits(balance, decimals);
  }

  private processProvider(chain: AvailableWalletChains) {
    let rpc: string;

    switch (chain) {
      case AvailableWalletChains.BASE:
        rpc = this.configService.getOrThrow(BASE_SEPOLIA_RPC_URL);
        break;
      default:
        rpc = this.configService.getOrThrow(ETH_SEPOLIA_RPC_URL);
        break;
    }

    return new ethers.JsonRpcProvider(rpc);
  }
}

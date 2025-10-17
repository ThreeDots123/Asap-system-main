import { AvailableWalletChains } from "src/common/types/wallet-custody";

export const walletChainDetails: Record<
  AvailableWalletChains,
  { name: string; logoUrl: string }
> = {
  [AvailableWalletChains.AVALANCHE]: {
    name: "avalanche",
    logoUrl:
      "https://res.cloudinary.com/blockradar/image/upload/v1749742059/crypto-assets/avalanche-avax-logo_jitelk.png",
  },
  [AvailableWalletChains.BASE]: {
    name: "base",
    logoUrl:
      "https://res.cloudinary.com/blockradar/image/upload/v1749742059/crypto-assets/avalanche-avax-logo_jitelk.png",
  },
  [AvailableWalletChains.ERC20]: {
    name: "ethereum",
    logoUrl:
      "https://res.cloudinary.com/blockradar/image/upload/v1749742059/crypto-assets/avalanche-avax-logo_jitelk.png",
  },
};

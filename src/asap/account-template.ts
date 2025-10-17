import { Types } from "mongoose";

export const applicationAccountNames = {
  platformWallets: {
    blockradar: {
      erc20: "Blockradar ERC20 hot wallet",
      base: "Blockradar BASE hot wallet",
      avalanche: "Blockradar AVALANCHE hot wallet",
    },
    yellowcard: "Yellow-card liquidity Account",
  },
};

const applicationAccounts: {
  name: string;
  currency: string;
  balance: Types.Decimal128 | Record<string, Types.Decimal128>;
  metadata?: {};
}[] = [
  {
    name: applicationAccountNames.platformWallets.blockradar.base,
    currency: "N/A",
    balance: { ETH: Types.Decimal128.fromString("0") },
    metadata: {},
  },
  {
    name: applicationAccountNames.platformWallets.blockradar.base,
    currency: "N/A",
    balance: { ETH: Types.Decimal128.fromString("0") },
    metadata: {},
  },
  {
    name: applicationAccountNames.platformWallets.blockradar.avalanche,
    currency: "N/A",
    balance: { AVAX: Types.Decimal128.fromString("0") },
    metadata: {},
  },
  {
    name: "Yellow-card liquidity Account",
    currency: "USD",
    balance: Types.Decimal128.fromString("0"),
    metadata: {},
  },
];

export default applicationAccounts;

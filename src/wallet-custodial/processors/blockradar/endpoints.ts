const version = "/v1";

export const createWalletAddress = (chainId: string) =>
  version + "/wallets/" + chainId + "/addresses";

export const getWalletBalances = (chainId: string, addressId: string) =>
  version + "/wallets/" + chainId + "/addresses/" + addressId + "/balances";

export const withdrawWalletAsset = (chainId: string, addressId: string) =>
  version + "/wallets/" + chainId + "/addresses/" + addressId + "/withdraw";

export const withdrawWalletAssetFromMaster = (masterChainId: string) =>
  version + "/wallets/" + masterChainId + "/withdraw";

export const assetWithdrawalFee = (chainId: string, addressId: string) =>
  withdrawWalletAsset(chainId, addressId) + "/network-fee";

export const getWalletInfo = (chainId: string, addressId: string) =>
  version + "/wallets/" + chainId + "/addresses/" + addressId;

export const getWalletTransactions = (chainId: string, addressId: string) =>
  version + "/wallets/" + chainId + "/addresses/" + addressId + "/transactions";

export const getRates = (assetSymbol: string, currency: string) =>
  version + "/assets/rates?assets=" + assetSymbol + "&currency=" + currency;

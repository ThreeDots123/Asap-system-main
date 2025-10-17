import {
  providerId as yellowcardProviderId,
  YellowCardProviderProcessor,
} from "./providers/yellow-card";

const LIQUIDITY_PROVIDER_PROCESSORS = [YellowCardProviderProcessor];

export const liquidityProviderOpts = {
  "yellow-card": yellowcardProviderId,
} satisfies Readonly<Record<string, string>>;

export default LIQUIDITY_PROVIDER_PROCESSORS;

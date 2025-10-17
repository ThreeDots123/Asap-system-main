import {
  BlockradarProcessor,
  providerId as blockradarProviderId,
} from "./blockradar/index.processor";

const WALLET_CUSTODIAL_PROCESSORS = [BlockradarProcessor];

export const custodialProcessorOpts = {
  blockradar: blockradarProviderId,
} satisfies Readonly<Record<string, string>>;

export default WALLET_CUSTODIAL_PROCESSORS;

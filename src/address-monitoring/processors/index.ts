import { AlchemyProcessor, providerId as alchemyProviderId } from "./alchemy";

const ADDRESSES_MONITORING_PROCESSORS = [AlchemyProcessor];

export const addressMonitoringOpts = {
  alchemy: alchemyProviderId,
} satisfies Readonly<Record<string, string>>;

export default ADDRESSES_MONITORING_PROCESSORS;

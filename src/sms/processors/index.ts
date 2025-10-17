import {
  providerId as twilioProviderId,
  TwilioSMSProcessor,
} from "./twilio/index.processor";

const SMS_PROCESSORS = [TwilioSMSProcessor];

export const ProcessorOpts = {
  twilio: twilioProviderId,
} satisfies Readonly<Record<string, string>>;

export default SMS_PROCESSORS;

export const channels = "/business/channels";
export const rates = "/business/rates";
export const networks = "/business/networks";
export const validateAccountUrl = "/business/details/bank";
export const createWebhook = "/business/webhooks";
export const deleteWebhookUrl = (webhookId: string) => "/business/" + webhookId;
export const initiateRecipientPayoutUrl = "/business/payments";
export const acceptSubmissionRequest = (id: string) =>
  `/business/payments/${id}/accept`;

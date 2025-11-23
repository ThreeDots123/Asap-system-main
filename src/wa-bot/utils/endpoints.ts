const version = "v24.0/";

export const qrCodeAndDeepLinkRoute = (phoneId: string) =>
    version + phoneId + "/message_qrdls";

export const sendMessageRoute = (phoneId: string) =>
    version + phoneId + "/messages";
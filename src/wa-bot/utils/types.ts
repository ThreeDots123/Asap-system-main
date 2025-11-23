export interface ApiResponse<T = any> {
    data?: T;
    [key: string]: any;
}

export interface CreateQrCodeAndDeepLinkResponse{
    code: string;
    prefilled_message: string;
    deep_link_url: string;
    qr_image_url: string;
}

interface Button {
    type: string;
    reply: {
        id: string;
        title: string;
    },
}

export interface ReplyButton {
    buttons: Button[];
}

export interface List {
    button: string;
    sections: Array<{
        title: string;
        rows: Array<{
            id: string;
            title: string;
            description: string;
        }>;
    }>;
};

export interface WhatsappWebhookPayload {
    object: string;
    entry: Array<{
        id: string;
        changes: Array<{
            field: string;
            value: {
                messaging_product: "whatsapp";
                metadata: {
                    display_phone_number: string;
                    phone_number_id: string;
                };
                contacts?: Array<{
                    profile: {
                        name: string;
                    };
                    wa_id: string;
                }>;
                messages?: Array<{
                    from: string;
                    id: string;
                    timestamp: string;
                    type: "text" | string;
                    text?: {
                        body: string
                    };
                    interactive?: {
                        type: "button_reply" | "list_reply" | string;
                        button_reply?: {
                            id: string;
                            title: string;
                        },
                        list_reply?: {
                            id: string;
                            title: string;
                            description: string;
                        }
                    };
                }>;
                statuses?: any[];
            };
        }>;
    }>;
}
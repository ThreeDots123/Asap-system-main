import { Injectable, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN } from 'src/config/env/list';
import { ApiResponse, CreateQrCodeAndDeepLinkResponse, List, ReplyButton, WhatsappWebhookPayload } from './utils/types';
import { qrCodeAndDeepLinkRoute, sendMessageRoute } from './utils/endpoints';

@Injectable()
export class WaBotService implements OnModuleInit {
    private baseUrl = "https://graph.facebook.com/";
    private httpClient: AxiosInstance;
    private phoneId: string;

    onModuleInit() {
        this.httpClient = axios.create({
          baseURL: this.baseUrl,
          timeout: 30000,
        });
        this.phoneId = this.configService.getOrThrow<string>(WHATSAPP_PHONE_ID);
    }

    constructor(
        private configService: ConfigService,
    ) {}

    public async createQrCodeAndDeepLink(message: string): Promise<void> {
        if (!message) {
            throw new InternalServerErrorException(
                "Unable to create QrCode and DeepLink, No message provided",
            );
        }

        const url = qrCodeAndDeepLinkRoute(this.phoneId);
        const payload = {
            prefilled_message: message,
            generate_qr_image: "SVG"
        };

        const response = await this.execute<{}>({
            method: "POST",
            endpoint: url,
            data: payload,
        });
        console.log(response);
    }

    // Verify webhook token
    public verifyWebhookToken(passedToken: string): boolean {
        const expected = this.configService.getOrThrow<string>(
            WHATSAPP_VERIFY_TOKEN,
        );
        return passedToken === expected;
    }

    // Handle all Incoming WhatsApp webhooks
    public async handleIncomingWebhook(payload: WhatsappWebhookPayload): Promise<void> {
        // Respond to incoming text messages
        for (const entry of payload.entry || []) {
            for (const change of entry.changes || []) {
                const value = change.value;
                const msg = value.messages?.[0];

                if (msg && msg.type === "text" && msg.text?.body) {
                    const text = msg.text.body.trim();
                    const to = msg.from; // WhatsApp user wa_id
                    await this.resolveCommand(to, text);
                }

                if (msg && msg.type === "interactive" && msg.interactive?.button_reply?.id) {
                    const text = msg.interactive.button_reply.id.trim();
                    const to = msg.from; // WhatsApp user wa_id
                    console.log("reply-btn", text);
                    await this.resolveCommand(to, text);
                }

                if (msg && msg.type === "interactive" && msg.interactive?.list_reply?.id) {
                    const text = msg.interactive.list_reply.id.trim();
                    const to = msg.from; // WhatsApp user wa_id
                    console.log("reply-list", text);
                    await this.resolveCommand(to, text);
                }
            }
        }
    }

    // Simple command resolver
    protected async resolveCommand(to: string, text: string): Promise<void> {
        const lower = text.toLowerCase();

        if (["hi", "hello", "hey", "help"].includes(lower)) {
            const msg = "*ASAP - Accept Crypto. Get paid in Cash. Instantly!* \n\n ```The Bridge between your crypto and everyday money.``` \n\n Use the following keywords where interacting with the bot: \n\n - *pay* : Use this command to initiate payment flow with ASAP. \n\n - *help* : Use this command to get helpful info on how to use the ASAP bot. \n\n - *support* : Use this command to get connect with the ASAP customer support.";
            await this.sendImageMessage(
                to,
                "https://i.imgur.com/7ZBlsWJ.png",
                msg,
            );
        }

        if (lower === "process-payment") {
            const msg = "*ASAP - Accept Crypto. Get paid in Cash. Instantly!* \n\n ```The Bridge between your crypto and everyday money.```\n\n ";
            await this.sendInteractiveMessage(
                to,
                msg,
                "list",
                {
                    buttons: [
                        {
                            type: "reply",
                            reply: {
                                id: "process-payment",
                                title: "Process Payment 💳"
                            }
                        },
                    ]
                },
                "https://i.imgur.com/7ZBlsWJ.png",
            );
        }

        if(lower === "pay") {
            const msg = "Please enter the amount you'll to pay in Naira.";
            await this.sendTextMessage(
                to,
                msg,
            );
        }

        if(!isNaN(Number(text))) {
            const msg = "Select your cryptocurrency of choice.";
            await this.sendInteractiveMessage(
                to,
                msg,
                "list",
                {
                    button: "Pick a crypto",
                    sections: [
                        {
                            title: "Cryptocurrencies",
                            rows: [
                                {
                                    id: "usdc",
                                    title: "USDC",
                                    description: "Stablecoin powered by Circle."
                                },
                                {
                                    id: "usdt",
                                    title: "USDT",
                                    description: "Stablecoin powered by Tether."
                                },
                            ]
                        }
                    ]
                }
            );
        }

        if(["usdc", "usdt"].includes(lower)) {
            const msg = "Select your blockchain of choice.";
            await this.sendInteractiveMessage(
                to,
                msg,
                "list",
                {
                    button: "Pick a chain",
                    sections: [
                        {
                            title: "Chains",
                            rows: [
                                {
                                    id: "base",
                                    title: "Base",
                                    description: "EVM Layer 2 blockchain powered by Coinbase."
                                },
                                {
                                    id: "ethereum",
                                    title: "Ethereum",
                                    description: "Layer 1 blockchain."
                                },
                            ]
                        }
                    ]
                }
            );
        }
    }

    // Send a WhatsApp text message using Graph API
    async sendTextMessage(
        phoneNumber: string,
        body: string,
    ): Promise<void> {
        if (!phoneNumber) {
            throw new InternalServerErrorException(
                "Missing phone_number in webhook metadata",
            );
        }

        const url = sendMessageRoute(this.phoneId);
        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: `+${phoneNumber}`,
            type: "text",
            text: {
                preview_url: false,
                body: body,
            }
        };

        const response = await this.execute<{}>({
            method: "POST",
            endpoint: url,
            data: payload,
        });
        console.log(response);
    }

    // Send a WhatsApp image message using Graph API
    async sendImageMessage(
        phoneNumber: string,
        image: string,
        caption: string,
    ): Promise<void> {
        if (!phoneNumber) {
            throw new InternalServerErrorException(
                "Missing phone_number in webhook metadata",
            );
        }

        const url = sendMessageRoute(this.phoneId);
        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: `+${phoneNumber}`,
            type: "image",
            image: {
                link: image,
                caption: caption,
            }
        };

        const response = await this.execute<{}>({
            method: "POST",
            endpoint: url,
            data: payload,
        });
        console.log(response);
    }

    // Send a WhatsApp image message using Graph API
    async sendInteractiveMessage(
        phoneNumber: string,
        body: string,
        type: "button" | "list",
        action: ReplyButton | List,
        image?: string,
    ): Promise<void> {
        if (!phoneNumber) {
            throw new InternalServerErrorException(
                "Missing phone_number in webhook metadata",
            );
        }

        const url = sendMessageRoute(this.phoneId);
        let payload = {};

        if(image) {
            payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: `+${phoneNumber}`,
                type: "interactive",
                interactive: {
                    type: type,
                    header: {
                        type: "image",
                        image: {
                            link: image,
                        }
                    },
                    body: {
                        text: body,
                    },
                    footer: {
                        text: "⚡️ Powered by ASAP",
                    },
                    action: action,
                }
            };
        } else {
            payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: `+${phoneNumber}`,
                type: "interactive",
                interactive: {
                    type: type,
                    body: {
                        text: body,
                    },
                    action: action,
                }
            };
        }

        const response = await this.execute<{}>({
            method: "POST",
            endpoint: url,
            data: payload,
        });
        console.log(response);
    }

    /**
       * Get authentication headers for WhatsApp API requests.
       *
       * @returns Headers object with authentication
    */
    private getHeaders(): Record<string, string> {
        return {
            "Authorization": `Bearer ${this.configService.getOrThrow<string>(WHATSAPP_ACCESS_TOKEN)}`,
            "Content-Type": "application/json",
        };
    }

    /**
       * Make an authenticated request to WhatsApp API.
       *
       * @param method - HTTP method
       * @param endpoint - API endpoint
       * @param data - Request data (for POST/PUT requests)
       * @param params - Query parameters
       * @returns Promise resolving to API response
    */
    private async execute<T = any>(requestData: {
        method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
        endpoint: string;
        data?: any;
        params?: Record<string, any>;
    }): Promise<ApiResponse<T>> {
        const { endpoint, method, data, params } = requestData;
    
        const url = `/${endpoint.replace(/^\//, "")}`;
        const headers = this.getHeaders();
    
        try {
            const response: AxiosResponse<{
                message: string;
                statusCode: number;
                data: T;
            }> = await this.httpClient.request({
                method,
                url,
                headers,
                data,
                params,
            });
    
          return response.data;
        } catch (error) {
            console.error(`WhatsApp API request failed`, error);
            throw error;
        }
    }
}

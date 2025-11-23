import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { WaBotService } from './wa-bot.service';

@Controller('wa-bot')
export class WaBotController {
    constructor(private readonly waBotService: WaBotService) {}

    @Post("create-qr-dl")
    async createQrCodeAndDeepLink(
        @Body()
        body: { message: string; },
    ) {
        const { message } = body;
        const result = this.waBotService.createQrCodeAndDeepLink(message);

        return {
            message: "WhatsApp QrCode and Deep Link created",
            statusCode: 200,
            data: result,
        };
    }
}

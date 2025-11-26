import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { WaBotService } from './wa-bot.service';

@Controller('wa-bot')
export class WaBotController {
    constructor(private readonly waBotService: WaBotService) {}

    @Post("create-qr-dl")
    @HttpCode(200)
    async createQrCodeAndDeepLink(
        @Body()
        body: { message: string; },
    ) {
        const { message } = body;
        const result = this.waBotService.createQrCodeAndDeepLink(message);

        return {
            message: "WhatsApp QrCode and Deep Link created",
            data: result,
        };
    }

    @Get("get-all-qr-dl")
    @HttpCode(200)
    async getAllQrCodesAndDeepLinks() {
        const result = this.waBotService.getAllQrCodesAndDeepLinks();

        return {
            message: "All WhatsApp QrCodes and Deep Links retrived",
            data: result,
        };
    }
}

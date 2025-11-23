import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import * as crypto from "crypto";
import { ConfigService } from "@nestjs/config";
import {
  ALCHEMY_BASE_SIGNING_KEY,
  ALCHEMY_ETH_SIGNING_KEY,
  ALCHEMY_USE_MAINNET,
  BLOCKRADAR_GLOBAL_API_KEY,
  WHATSAPP_APP_SECRET,
  YC_SECRET_KEY,
} from "src/config/env/list";
import { LiquidityProviderService } from "src/liquidity-provider/liquidity-provider.service";
import { SubmittedPayoutEvent } from "src/liquidity-provider/providers/yellow-card/types";
import { LiquidityProviderProcessorType } from "src/common/types/liquidity-provider";
import { BlockradarWebhookEvent } from "src/wallet-custodial/processors/blockradar/types";
import { WalletCustodialService } from "src/wallet-custodial/wallet-custodial.service";
import {
  AvailableWalletChains,
  ProcessorType,
} from "src/common/types/wallet-custody";
import { WebhookEventPayload } from "src/address-monitoring/processors/alchemy/types";
import { AddressMonitoringService } from "src/address-monitoring/address-monitoring.service";
import { WhatsappWebhookPayload } from "src/wa-bot/utils/types";
import { WaBotService } from "src/wa-bot/wa-bot.service";

@Controller("webhook")
export class WebhookController {
  constructor(
    private configService: ConfigService,
    private liquidityProviderService: LiquidityProviderService,
    private walletCustodialService: WalletCustodialService,
    private addressMonitoringService: AddressMonitoringService,
    private waBotService: WaBotService,
  ) {}

  // Dedicate a webhook url for each Liquidity Provider. Because there are multiple event scenarios to listen for
  @Post("liquidity/payout/YC")
  @HttpCode(200)
  async handleLiquidityProviderPayout(
    @Req() request: Request,
    @Body() _body: Record<string, any>,
  ) {
    // Check YELLOW CARD authorization
    const YC_SIGNATURE_HEADER = request.headers["x-yc-signature"];
    if (YC_SIGNATURE_HEADER) {
      const computedSignature = crypto
        .createHmac(
          "sha256",
          this.configService.getOrThrow<string>(YC_SECRET_KEY),
        )
        .update(JSON.stringify(_body))
        .digest("base64");

      if (computedSignature === YC_SIGNATURE_HEADER) {
        // Run Yellow card provider webhook handler
        const event = _body as SubmittedPayoutEvent;

        // Check if event is a payout event
        await this.liquidityProviderService.handlePayoutWebhook(
          LiquidityProviderProcessorType.YC,
          _body,
          event.sequenceId,
        );
      }

      return;
    }
  }

  // Dedicate a webhook url for each wallet custodial. Because there are multiple event scenarios to listen for
  @Post("wallet/blockradar")
  @HttpCode(200)
  async handleAssetWithdraw(
    @Req() request: Request,
    @Body() _body: Record<string, any>,
  ) {
    // CHECK BLOCKRADAR Authorization
    const BLOCKRADAR_SIGNATURE_HEADER =
      request.headers["x-blockradar-signature"];
    const computedSignature = crypto
      .createHmac(
        "sha512",
        this.configService.getOrThrow(BLOCKRADAR_GLOBAL_API_KEY),
      )
      .update(JSON.stringify(_body))
      .digest("hex");

    if (BLOCKRADAR_SIGNATURE_HEADER === computedSignature) {
      // Run blockradar custody provider webhook handler
      // Check if event is a withdrawal event
      const { event, data } = _body as BlockradarWebhookEvent;

      const eventSplit = event.split(".");

      if (eventSplit[0] === "withdraw") {
        await this.walletCustodialService.handleAssetWithdrawalWebhook(
          ProcessorType.BLOCKRADAR,
          { event, data },
          data.reference,
          data.gasFee ?? "0",
        );
        return;
      } else if (eventSplit[0] === "deposit") {
        if (eventSplit[1] === "swept") {
          await this.walletCustodialService.handleAssetSweepWebhook(
            { type: ProcessorType.BLOCKRADAR, reference: data.reference },
            data.gasFee ?? "0",
          );
        } else {
          await this.walletCustodialService.handleAssetDepositWebhook(
            { type: ProcessorType.BLOCKRADAR, reference: data.reference },
            {
              recipientAddr: data.recipientAddress,
              fromAddr: data.senderAddress,
              transactionHash: data.hash,
              amount: data.amount,
              chain: data.blockchain.name as AvailableWalletChains,
              asset: data.asset.name,
              blockNo: String(data.blockNumber ?? ""),
              reference: data.reference,
            },
          );
        }
      }
    }

    return;
  }

  // Dedicate for getting address webhooks with alchemy
  @Post("address/monitor/alchemy")
  @HttpCode(200)
  async handleAlchemyAddressWebhook(
    @Req() request: Request,
    @Body() _body: Record<string, any>,
  ) {
    // Check ALCHEMY authorization
    const ALCHEMY_SIGNATURE_HEADER = request.headers["x-alchemy-signature"];
    const webhookEvent = _body as WebhookEventPayload;

    const signingKey =
      webhookEvent.event.network ===
      (this.configService.getOrThrow(ALCHEMY_USE_MAINNET) === "true"
        ? "BASE_MAINNET"
        : "BASE_SEPOLIA")
        ? this.configService.getOrThrow(ALCHEMY_BASE_SIGNING_KEY)
        : this.configService.getOrThrow(ALCHEMY_ETH_SIGNING_KEY);

    if (ALCHEMY_SIGNATURE_HEADER) {
      const computedSignature = crypto
        .createHmac("sha256", signingKey)
        .update(JSON.stringify(_body))
        .digest("hex");

      if (ALCHEMY_SIGNATURE_HEADER === computedSignature) {
        switch (webhookEvent.type) {
          case "ADDRESS_ACTIVITY": {
            const [tx] = webhookEvent.event.activity;
            await this.addressMonitoringService.handleWalletActivity(
              tx.toAddress,
              tx.fromAddress,
            );
            break;
          }
          default:
            break;
        }
      }
    }

    return;
  }

  // Webhook verification
  @Get("whatsapp")
  @HttpCode(200)
  verifyWebhook(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") verifyToken: string,
    @Query("hub.challenge") challenge: string,
    @Res() res: Response,
  ) {
    if (mode === "subscribe" && this.waBotService.verifyWebhookToken(verifyToken)) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send("Verification failed");
  }

  // Dedicate a webhook url for WhatsApp.
  @Post("whatsapp")
  @HttpCode(200)
  async handleWhatsAppWebhook(
    @Req() request: Request,
    @Body() _body: Record<string, any>,
  ) {
    // Check WhatsApp authorization
    const WHATSAPP_SIGNATURE_HEADER = request.headers["x-hub-signature-256"]?.toString().split("=")[1];
    const webhookEvent = _body as WhatsappWebhookPayload;
    const signingKey = this.configService.getOrThrow(WHATSAPP_APP_SECRET);

    if (WHATSAPP_SIGNATURE_HEADER) {
      const computedSignature = crypto
        .createHmac(
          "sha256",
          signingKey,
        )
        .update(JSON.stringify(_body), "utf-8")
        .digest("hex");

      console.log(WHATSAPP_SIGNATURE_HEADER, computedSignature, WHATSAPP_SIGNATURE_HEADER === computedSignature)

      if (WHATSAPP_SIGNATURE_HEADER === computedSignature) {
        // Run Whatsapp webhook handler
        console.log(
          "Processing webhook event:",
          JSON.stringify(webhookEvent, null, 2),
        );

        await this.waBotService.handleIncomingWebhook(webhookEvent);

        return "OK";
      }
    }

    return;
  }
}

// 0xD3612aA72A31a23f3F7599B89F933a379bcB155F

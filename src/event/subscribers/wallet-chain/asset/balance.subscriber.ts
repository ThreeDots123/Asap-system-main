import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Types } from "mongoose";
import {
  AvailableWalletChains,
  RetrieveAssetResponse,
} from "src/common/types/wallet-custody";
import events from "src/event";
import { emittedEvents } from "src/gateway/events";
import { SocketGateway } from "src/gateway/socket.gateway";

export class AssetBalanceChangedEvent {
  constructor(
    public readonly userId: Types.ObjectId,
    public readonly assets: Array<{
      chain: AvailableWalletChains;
      assets: Array<{
        name: RetrieveAssetResponse["name"];
        balance: RetrieveAssetResponse["balance"];
        convertedBalance: RetrieveAssetResponse["convertedBalance"];
      }>;
    }>,
  ) {}
}

@Injectable()
export class AssetBalanceChangeSubscriber {
  private readonly logger = new Logger(AssetBalanceChangeSubscriber.name);

  constructor(private socketGateway: SocketGateway) {}

  @OnEvent(events["asset-balance"].change)
  async handleAssetBalanceChange(data: {
    event: AssetBalanceChangedEvent;
    eventId?: string;
  }) {
    const {
      event: { assets, userId },
    } = data;

    this.logger.log(`Balance updated for user, ${userId}`);

    // When there is an asset change send the array of chains and their assets new balances as a socket.
    const room = this.socketGateway.createRoomName(userId.toString());
    this.socketGateway.server
      .to(room)
      .emit(emittedEvents.refreshedAssetBalance, {
        message: "Asset balance updated.",
        data: assets,
      });
  }
}

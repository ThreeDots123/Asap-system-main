import { Injectable, Logger } from "@nestjs/common";
import { Types } from "mongoose";
import events from "src/event";
import { EventService } from "src/event/event.service";
import { OfframTransactionFundedEvent } from "src/event/subscribers/offramp/transaction.subscriber";
import {
  OfframpTransactionDocument,
  PaymentTransactionStatus,
} from "src/models/offramp-transaction";
import { WalletCustodialService } from "src/wallet-custodial/wallet-custodial.service";

const {
  offramp: {
    transaction: { funded },
  },
} = events;

@Injectable()
export class OfframpService {
  constructor(
    private walletCustodialService: WalletCustodialService,
    private eventService: EventService,
  ) {}

  async initiate(
    data:
      | {
          walletType: "internal";
          userId: Types.ObjectId;
          transactionRef: string;
          offrampTxn: OfframpTransactionDocument;
        }
      | { walletType: "external"; offrampTxn: OfframpTransactionDocument },
  ) {
    if (data.walletType === "internal") {
      // Debit from internal wallet
      const response = await this.walletCustodialService.transferChainAsset(
        data.userId,
        data.transactionRef,
        "regular",
      );

      // Receives a webhook for this withdrawal transaction where we update the offramp transaction and emit an event to continue the offramping process
      if (response.webhookEvent) return;

      // Continue process as the withdrawal transaction happened internally
    }

    const { offrampTxn } = data;
    offrampTxn.status = PaymentTransactionStatus.FUNDED;
    this.eventService.emit(funded, {
      event: new OfframTransactionFundedEvent(offrampTxn),
    });

    await offrampTxn.save();
    console.log("Processing");

    return {
      message: "Your asset has been processed sucessfully. Processing payout.",
      status: offrampTxn.status,
    };
  }
}

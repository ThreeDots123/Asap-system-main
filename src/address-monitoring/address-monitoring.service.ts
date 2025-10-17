import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from "@nestjs/common";
import { AddressMonitoringProcessorType } from "src/common/types/address-monitoring";
import { AbstractAddressMonitoringProcessor } from "src/interface/monitor-addresses";
import { AlchemyProcessor } from "./processors/alchemy";
import { addressMonitoringOpts } from "./processors";
import { AvailableWalletChains } from "src/common/types/wallet-custody";

@Injectable()
export class AddressMonitoringService implements OnModuleInit {
  currentAddressMonitoringProcessor = addressMonitoringOpts.alchemy;
  private processors: Map<
    AddressMonitoringProcessorType,
    AbstractAddressMonitoringProcessor
  > = new Map();

  constructor(private alchemyProcessor: AlchemyProcessor) {}

  async onModuleInit() {
    await this.registerProcessors();
  }

  async updateAddressesToMonitor(
    addresses: string[],
    action: "add" | "remove",
    chain: AvailableWalletChains,
  ) {
    const processor = this.processAddressMonitoringProcessors(
      this.currentAddressMonitoringProcessor,
    );

    if (action === "add")
      return processor.addAddressesForMonitoring(addresses, chain);
    else return processor.removeAddressesFromMonitoring(addresses, chain);
  }

  async handleWalletActivity(address: string) {
    const processor = this.processAddressMonitoringProcessors(
      this.currentAddressMonitoringProcessor,
    );

    await processor.handleAddressActivityEvent(address);
    return;
  }

  private async registerProcessors(): Promise<void> {
    // Register each processor with its provider ID on the instantiated service
    await this.registerProcessor(this.alchemyProcessor);
  }

  private async registerProcessor(
    processor: AbstractAddressMonitoringProcessor,
  ) {
    const providerId = await processor.getProviderId();

    if (this.processors.has(providerId))
      throw new Error(
        "Processor with a providerId of " + providerId + " already exists",
      );

    // Append provider to intance service
    this.processors.set(providerId, processor);
  }

  private processAddressMonitoringProcessors(
    processorId: AddressMonitoringProcessorType,
  ): AbstractAddressMonitoringProcessor {
    const processor = this.processors.get(processorId);

    if (!processor)
      throw new InternalServerErrorException(
        "Processor of id " + processorId + " has not been registered",
      );

    return processor;
  }
}

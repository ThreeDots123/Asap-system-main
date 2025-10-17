import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import {
  CryptoAsset,
  LiquidityProviderProcessorType,
} from "src/common/types/liquidity-provider";
import { AbstractLiquidityProvider } from "src/interface/liquidity-provider/abstract-provider";
import { YellowCardProviderProcessor } from "./providers/yellow-card";

@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistryService.name);
  private providers: Map<
    LiquidityProviderProcessorType,
    AbstractLiquidityProvider
  > = new Map();

  constructor(
    private readonly yellowcardProvider: YellowCardProviderProcessor,
  ) {}

  onModuleInit() {
    this.registerProvider(this.yellowcardProvider);
  }

  registerProvider(provider: AbstractLiquidityProvider): void {
    this.providers.set(provider.getProviderId(), provider);
    this.logger.log(`Registered provider: ${provider.getProviderId()}`);
  }

  getProvider(
    providerId: LiquidityProviderProcessorType,
  ): AbstractLiquidityProvider {
    const provider = this.providers.get(providerId);
    if (!provider)
      throw new BadRequestException(`Provider not found: ${providerId}`);

    return provider;
  }

  getProvidersForAsset(asset: CryptoAsset): AbstractLiquidityProvider[] {
    const supportingProviders: AbstractLiquidityProvider[] = [];
    for (const provider of this.providers.values()) {
      const isSupported = provider.isAssetSupported(asset);
      if (isSupported) {
        supportingProviders.push(provider);
      }
    }

    this.logger.log(
      `Found ${supportingProviders.length} providers supporting ${asset}`,
    );
    return supportingProviders;
  }
}

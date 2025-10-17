import { Test, TestingModule } from '@nestjs/testing';
import { LiquidityProviderService } from './liquidity-provider.service';

describe('LiquidityProviderService', () => {
  let service: LiquidityProviderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LiquidityProviderService],
    }).compile();

    service = module.get<LiquidityProviderService>(LiquidityProviderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { WalletCustodialService } from './wallet-custodial.service';

describe('WalletCustodialService', () => {
  let service: WalletCustodialService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletCustodialService],
    }).compile();

    service = module.get<WalletCustodialService>(WalletCustodialService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

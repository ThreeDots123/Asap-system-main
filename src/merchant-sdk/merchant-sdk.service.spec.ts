import { Test, TestingModule } from '@nestjs/testing';
import { MerchantSdkService } from './merchant-sdk.service';

describe('MerchantSdkService', () => {
  let service: MerchantSdkService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MerchantSdkService],
    }).compile();

    service = module.get<MerchantSdkService>(MerchantSdkService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

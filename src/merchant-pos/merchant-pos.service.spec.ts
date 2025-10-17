import { Test, TestingModule } from '@nestjs/testing';
import { MerchantPosService } from './merchant-pos.service';

describe('MerchantPosService', () => {
  let service: MerchantPosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MerchantPosService],
    }).compile();

    service = module.get<MerchantPosService>(MerchantPosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

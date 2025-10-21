import { Test, TestingModule } from '@nestjs/testing';
import { MerchantSdkController } from './merchant-sdk.controller';

describe('MerchantSdkController', () => {
  let controller: MerchantSdkController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantSdkController],
    }).compile();

    controller = module.get<MerchantSdkController>(MerchantSdkController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

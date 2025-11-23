import { Test, TestingModule } from '@nestjs/testing';
import { WaBotController } from './wa-bot.controller';

describe('WaBotController', () => {
  let controller: WaBotController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WaBotController],
    }).compile();

    controller = module.get<WaBotController>(WaBotController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

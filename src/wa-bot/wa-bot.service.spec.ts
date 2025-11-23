import { Test, TestingModule } from '@nestjs/testing';
import { WaBotService } from './wa-bot.service';

describe('WaBotService', () => {
  let service: WaBotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WaBotService],
    }).compile();

    service = module.get<WaBotService>(WaBotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

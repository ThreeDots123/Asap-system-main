import { Test, TestingModule } from '@nestjs/testing';
import { AsapService } from './asap.service';

describe('AsapService', () => {
  let service: AsapService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AsapService],
    }).compile();

    service = module.get<AsapService>(AsapService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

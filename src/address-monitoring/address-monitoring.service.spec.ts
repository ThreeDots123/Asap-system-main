import { Test, TestingModule } from '@nestjs/testing';
import { AddressMonitoringService } from './address-monitoring.service';

describe('AddressMonitoringService', () => {
  let service: AddressMonitoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AddressMonitoringService],
    }).compile();

    service = module.get<AddressMonitoringService>(AddressMonitoringService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

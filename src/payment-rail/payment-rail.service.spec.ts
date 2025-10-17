import { Test, TestingModule } from "@nestjs/testing";
import { PaymentRailService } from "./payment-rail.service";

describe("PaymentRailService", () => {
  let service: PaymentRailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentRailService],
    }).compile();

    service = module.get<PaymentRailService>(PaymentRailService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});

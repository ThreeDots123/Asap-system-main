import { Module } from '@nestjs/common';
import { KycService } from './kyc.service';

@Module({
  providers: [KycService]
})
export class KycModule {}

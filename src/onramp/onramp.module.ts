import { Module } from '@nestjs/common';
import { OnrampService } from './onramp.service';

@Module({
  providers: [OnrampService]
})
export class OnrampModule {}

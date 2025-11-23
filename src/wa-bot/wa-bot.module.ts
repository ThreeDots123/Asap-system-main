import { Module } from '@nestjs/common';
import { WaBotService } from './wa-bot.service';
import { WaBotController } from './wa-bot.controller';

@Module({
  providers: [WaBotService],
  controllers: [WaBotController],
  exports: [WaBotService],
})
export class WaBotModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatCreditCharge } from './entities/chat-credit-charge.entity';
import { CreditLedger } from './entities/credit-ledger.entity';
import { UserCreditAccount } from './entities/user-credit-account.entity';
import { CreditsService } from './credits.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserCreditAccount,
      CreditLedger,
      ChatCreditCharge,
    ]),
  ],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}

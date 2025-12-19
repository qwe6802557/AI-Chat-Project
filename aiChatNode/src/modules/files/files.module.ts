import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { ChatAttachment } from '../chat/entities/chat-attachment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ChatAttachment])],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}


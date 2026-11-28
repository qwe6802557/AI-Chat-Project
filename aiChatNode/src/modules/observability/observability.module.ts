import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentTrace } from './entities/agent-trace.entity';
import { AgentSpan } from './entities/agent-span.entity';
import { TraceStorageService } from './services/trace-storage.service';
import { TraceContextService } from './services/trace-context.service';
import { ObservabilityController } from './observability.controller';

/**
 * 全局可观测模块：提供 AsyncLocalStorage 全链路 Trace ID 透传与 Span 持久化服务
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AgentTrace, AgentSpan])],
  controllers: [ObservabilityController],
  providers: [TraceStorageService, TraceContextService],
  exports: [TraceStorageService, TraceContextService],
})
export class ObservabilityModule {}

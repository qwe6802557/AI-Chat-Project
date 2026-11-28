import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { AgentRole } from '../channel/entities/agent-role.entity';
import { ChatModule } from '../chat/chat.module';
import { CreditsModule } from '../credits/credits.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { ToolsModule } from '../tools/tools.module';
import { AgentWorkflow } from './entities/agent-workflow.entity';
import { DagWorkflowExecutorService } from './services/dag-workflow-executor.service';
import { WorkflowService } from './services/workflow.service';
import { WorkflowController } from './workflow.controller';

/**
 * 智能体可视化 DAG 工作流模块
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AgentWorkflow, AgentRole]),
    forwardRef(() => ChatModule),
    AiProviderModule,
    ToolsModule,
    forwardRef(() => KnowledgeBaseModule),
    CreditsModule,
  ],
  controllers: [WorkflowController],
  providers: [DagWorkflowExecutorService, WorkflowService],
  exports: [DagWorkflowExecutorService, WorkflowService],
})
export class WorkflowModule {}

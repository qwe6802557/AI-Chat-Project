import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { AIClientService } from './services/ai-client.service';
import { ChatMessage as ChatRecord } from './entities/chat.entity';
import { UserService } from '../user/user.service';
import { ChatSessionService } from './chat-session.service';
import { FilesService } from '../files/files.service';
import { AiModelService } from '../ai-provider/ai-model.service';
import { CreditsService } from '../credits/credits.service';
import { WebSearchService } from '../web-search/web-search.service';
import { ToolRegistryService } from '../tools/tools.registry.service';
import { ApprovalManagerService } from './services/approval-manager.service';
import { HybridRagService } from '../knowledge-base/services/hybrid-rag.service';

describe('ChatService - Human-in-the-Loop Approval', () => {
  let service: ChatService;

  const mockToolRegistryService = {
    getPlugin: jest.fn(),
    evaluateToolRisk: jest.fn(),
    executeTool: jest.fn(),
  };

  const mockApprovalManagerService = {
    createPendingApproval: jest.fn(),
    waitForDecision: jest.fn(),
    resolveApproval: jest.fn(),
    getPendingApproval: jest.fn(),
  };

  const mockAiClientService = {
    createStreamChatCompletion: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: AIClientService, useValue: mockAiClientService },
        { provide: getRepositoryToken(ChatRecord), useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: UserService, useValue: {} },
        { provide: ChatSessionService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => null } },
        { provide: FilesService, useValue: {} },
        { provide: AiModelService, useValue: {} },
        { provide: CreditsService, useValue: {} },
        { provide: WebSearchService, useValue: {} },
        { provide: ToolRegistryService, useValue: mockToolRegistryService },
        { provide: ApprovalManagerService, useValue: mockApprovalManagerService },
        { provide: HybridRagService, useValue: {} },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('高危工具需要审批时，流中暂停抛出 tool_approval_required，操作者放行后继续执行', async () => {
    mockToolRegistryService.getPlugin.mockReturnValue({
      metadata: { title: '代码解释器', icon: 'code' },
    });
    mockToolRegistryService.evaluateToolRisk.mockReturnValue({
      level: 'high',
      requiresApproval: true,
      reason: '沙箱代码执行风险',
    });
    mockApprovalManagerService.createPendingApproval.mockResolvedValue({
      approvalId: 'app_1',
    });
    mockApprovalManagerService.waitForDecision.mockResolvedValue({
      decision: 'approved',
      reason: '操作者允许执行',
    });
    mockToolRegistryService.executeTool.mockResolvedValue({
      id: 'rec_code',
      name: 'code_interpreter',
      result: { status: 'success', output: '42', durationMs: 80 },
    });

    let callCount = 0;
    mockAiClientService.createStreamChatCompletion.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return (async function* () {
          yield {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_code',
                  function: { name: 'code_interpreter', arguments: '{"code":"console.log(42)"}' },
                },
              ],
            },
          };
        })();
      } else {
        return (async function* () {
          yield {
            type: 'answer_delta',
            delta: { content: '执行结果是 42' },
          };
          yield {
            finish_reason: 'stop',
            usage: { promptTokens: 30, completionTokens: 10, totalTokens: 40 },
          };
        })();
      }
    });

    const toolRecords: any[] = [];
    const chunks: any[] = [];
    const stream = (service as any).executeReActStream({
      modelId: 'gpt-4o',
      initialMessages: [{ role: 'user', content: '运行代码' }],
      tools: [{ type: 'function', function: { name: 'code_interpreter' } }],
      context: { userId: 'u1', sessionId: 's1', userMessage: '运行代码' },
      toolExecutionRecords: toolRecords,
    });

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const approvalChunk = chunks.find((c) => c.type === 'tool_approval_required');
    expect(approvalChunk).toBeDefined();
    expect(approvalChunk.toolCall.status).toBe('pending_approval');
    expect(approvalChunk.toolCall.approvalId).toBe('app_1');
    expect(approvalChunk.toolCall.riskLevel).toBe('high');
    expect(mockApprovalManagerService.waitForDecision).toHaveBeenCalledWith('app_1');
    expect(mockToolRegistryService.executeTool).toHaveBeenCalled();

    const resultChunk = chunks.find((c) => c.type === 'tool_call_result');
    expect(resultChunk).toBeDefined();
    expect(resultChunk.toolCall.status).toBe('success');
  });

  it('高危工具被拒绝时，流中返回 rejected 状态并跳过工具实际调用', async () => {
    mockToolRegistryService.getPlugin.mockReturnValue({
      metadata: { title: '代码解释器', icon: 'code' },
    });
    mockToolRegistryService.evaluateToolRisk.mockReturnValue({
      level: 'high',
      requiresApproval: true,
      reason: '高危系统操作',
    });
    mockApprovalManagerService.createPendingApproval.mockResolvedValue({
      approvalId: 'app_2',
    });
    mockApprovalManagerService.waitForDecision.mockResolvedValue({
      decision: 'rejected',
      reason: '拒绝删除目录操作',
    });

    let callCount = 0;
    mockAiClientService.createStreamChatCompletion.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return (async function* () {
          yield {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_code_rej',
                  function: { name: 'code_interpreter', arguments: '{"code":"rmdir"}' },
                },
              ],
            },
          };
        })();
      } else {
        return (async function* () {
          yield {
            type: 'answer_delta',
            delta: { content: '由于操作被终止，未执行该脚本' },
          };
          yield {
            finish_reason: 'stop',
            usage: { promptTokens: 30, completionTokens: 10, totalTokens: 40 },
          };
        })();
      }
    });

    const toolRecords: any[] = [];
    const chunks: any[] = [];
    const stream = (service as any).executeReActStream({
      modelId: 'gpt-4o',
      initialMessages: [{ role: 'user', content: '删除目录' }],
      tools: [{ type: 'function', function: { name: 'code_interpreter' } }],
      context: { userId: 'u1', sessionId: 's1', userMessage: '删除目录' },
      toolExecutionRecords: toolRecords,
    });

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const resultChunk = chunks.find((c) => c.type === 'tool_call_result');
    expect(resultChunk).toBeDefined();
    expect(resultChunk.toolCall.status).toBe('rejected');
    expect(resultChunk.toolCall.error).toContain('拒绝删除目录操作');
    expect(mockToolRegistryService.executeTool).not.toHaveBeenCalled();
  });

  it('decideApproval 正常核准并返回状态', async () => {
    mockApprovalManagerService.getPendingApproval.mockResolvedValue({
      approvalId: 'app_3',
      userId: 'u1',
      status: 'pending',
    });
    mockApprovalManagerService.resolveApproval.mockResolvedValue({
      approvalId: 'app_3',
      status: 'approved',
      decisionReason: '同意执行',
      decidedAt: 1234567,
    });

    const res = await service.decideApproval('app_3', 'approved', 'u1', '同意执行');
    expect(res.approvalId).toBe('app_3');
    expect(res.status).toBe('approved');
    expect(res.decisionReason).toBe('同意执行');
  });
});

import {
  resolveModelReasoningProfile,
  resolveReasoningPanelTitle,
} from './reasoning-profile.util';

describe('resolveModelReasoningProfile', () => {
  it('marks GLM-5 on Zaiwen as raw reasoning capable', () => {
    expect(
      resolveModelReasoningProfile({
        providerName: 'Zaiwen',
        modelId: 'GLM-5',
      }),
    ).toMatchObject({
      capability: 'raw',
      strategy: 'provider_preferred',
      integration: 'inline_tag',
      badgeLabel: '支持思考过程',
    });
  });

  it('marks Claude compatibility route as reasoning hidden', () => {
    expect(
      resolveModelReasoningProfile({
        providerName: 'Claude',
        modelId: 'claude-opus-4-6',
      }),
    ).toMatchObject({
      capability: 'none',
      strategy: 'summary_preferred',
      integration: 'none',
    });
  });

  it('marks GPT-5 family as summary capable', () => {
    expect(
      resolveModelReasoningProfile({
        providerName: 'OpenAI',
        modelId: 'GPT-5.4',
      }),
    ).toMatchObject({
      capability: 'summary',
      strategy: 'summary_preferred',
      integration: 'responses_summary',
      badgeLabel: '支持思考摘要',
    });
  });
});

describe('resolveReasoningPanelTitle', () => {
  it('uses answer-oriented title for summary mode', () => {
    expect(resolveReasoningPanelTitle('summary', 'summary_preferred')).toBe(
      '已思考',
    );
  });

  it('uses process-oriented title for raw provider-preferred mode', () => {
    expect(resolveReasoningPanelTitle('raw', 'provider_preferred')).toBe(
      '思考过程',
    );
  });
});

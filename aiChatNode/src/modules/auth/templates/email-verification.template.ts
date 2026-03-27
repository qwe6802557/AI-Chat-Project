/**
 * 邮箱验证码邮件模板
 */
export interface EmailVerificationTemplateData {
  code: string;
  expiresIn: number;
}

/**
 * 生成邮箱验证码邮件HTML
 */
export function getEmailVerificationTemplate(
  data: EmailVerificationTemplateData,
): string {
  const { code, expiresIn } = data;

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ERJCHAT - 邮箱验证码</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #eef3f8;
      color: #142033;
      font-family: "SF Pro Display", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
      line-height: 1.6;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    .shell {
      width: 100%;
      background: linear-gradient(180deg, #eef3f8 0%, #f7f9fc 100%);
      padding: 36px 0;
    }
    .frame {
      max-width: 620px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #dce6f2;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 22px 48px rgba(19, 42, 74, 0.08);
    }
    .hero {
      padding: 36px 40px 28px;
      background:
        radial-gradient(circle at top right, rgba(61, 122, 255, 0.18), transparent 42%),
        linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
      border-bottom: 1px solid #dde7f3;
    }
    .eyebrow {
      display: inline-block;
      margin-bottom: 16px;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(28, 98, 255, 0.08);
      color: #245dcb;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .brand {
      margin: 0;
      font-size: 30px;
      line-height: 1.1;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: #11253f;
    }
    .hero-copy {
      margin: 14px 0 0;
      max-width: 420px;
      font-size: 14px;
      color: #4f637f;
    }
    .body {
      padding: 34px 40px 18px;
    }
    .title {
      margin: 0 0 8px;
      font-size: 24px;
      line-height: 1.3;
      font-weight: 700;
      color: #10233a;
    }
    .lead {
      margin: 0;
      font-size: 15px;
      color: #526780;
    }
    .code-panel {
      margin: 28px 0 22px;
      padding: 28px;
      border-radius: 22px;
      background: linear-gradient(180deg, #0f1d31 0%, #172842 100%);
      color: #ffffff;
    }
    .code-caption {
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.64);
    }
    .code-value {
      margin: 16px 0 12px;
      font-size: 38px;
      line-height: 1;
      font-weight: 700;
      letter-spacing: 0.34em;
      color: #f8fbff;
      font-family: "SFMono-Regular", "Consolas", "Liberation Mono", monospace;
    }
    .code-meta {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.74);
    }
    .notes {
      margin: 0;
      padding-left: 18px;
      color: #51657e;
      font-size: 14px;
    }
    .notes li {
      margin-bottom: 10px;
    }
    .notes li:last-child {
      margin-bottom: 0;
    }
    .info-band {
      margin-top: 28px;
      padding-top: 22px;
      border-top: 1px solid #e1e8f0;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .info-item {
      min-width: 180px;
    }
    .info-label {
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #8a98ad;
      margin-bottom: 6px;
    }
    .info-value {
      font-size: 14px;
      color: #20354d;
    }
    .footer {
      padding: 20px 40px 34px;
      color: #7f90a6;
      font-size: 12px;
      line-height: 1.8;
    }
    @media only screen and (max-width: 640px) {
      .hero,
      .body,
      .footer {
        padding-left: 24px !important;
        padding-right: 24px !important;
      }
      .brand {
        font-size: 26px !important;
      }
      .title {
        font-size: 22px !important;
      }
      .code-value {
        font-size: 30px !important;
        letter-spacing: 0.22em !important;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="frame">
      <div class="hero">
        <div class="eyebrow">ERJ CHAT</div>
        <h1 class="brand">邮箱验证</h1>
        <p class="hero-copy">
          您正在完成账户安全验证。请使用下方验证码继续注册或身份确认。
        </p>
      </div>

      <div class="body">
        <h2 class="title">这是您的本次验证码</h2>
        <p class="lead">
          为保护账户安全，验证码仅在短时间内有效，请尽快完成验证。
        </p>

        <div class="code-panel">
          <div class="code-caption">Verification Code</div>
          <div class="code-value">${code}</div>
          <div class="code-meta">有效期 ${expiresIn} 分钟。验证码仅可使用一次。</div>
        </div>

        <ul class="notes">
          <li>请勿将验证码透露给任何人，ERJCHAT 工作人员不会向您索取验证码。</li>
          <li>如果这不是您的操作，请忽略本邮件；未完成验证前不会自动创建新会话。</li>
          <li>若验证码失效，请返回页面重新获取，不要重复使用旧验证码。</li>
        </ul>

        <div class="info-band">
          <div class="info-item">
            <div class="info-label">来源</div>
            <div class="info-value">ERJCHAT</div>
          </div>
          <div class="info-item">
            <div class="info-label">安全状态</div>
            <div class="info-value">本邮件由系统自动发送，请勿直接回复</div>
          </div>
        </div>
      </div>

      <div class="footer">
        如果您没有发起本次验证请求，建议检查账户环境并忽略本邮件。<br />
        © 2026 ERJCHAT. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * 生成邮箱验证码邮件纯文本版本（备用）
 */
export function getEmailVerificationTextTemplate(
  data: EmailVerificationTemplateData,
): string {
  const { code, expiresIn } = data;

  return `
ERJCHAT - 邮箱验证

您好！

您正在完成 ERJCHAT 的账户安全验证，请使用以下验证码继续操作：

验证码：${code}
有效期：${expiresIn} 分钟

安全提示：
- 验证码仅可使用一次，请勿向任何人泄露
- ERJCHAT 工作人员不会索取您的验证码
- 如果不是您本人操作，请忽略本邮件

此邮件由系统自动发送，请勿直接回复。

© 2025 ERJCHAT. All rights reserved.
  `.trim();
}

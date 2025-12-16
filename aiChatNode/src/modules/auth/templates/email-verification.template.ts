/**
 * 邮箱验证码邮件模板
 */
export interface EmailVerificationTemplateData {
  code: string; // 验证码
  expiresIn: number; // 有效期
}

/**
 * 生成邮箱验证码邮件HTML
 */
export function getEmailVerificationTemplate(data: EmailVerificationTemplateData): string {
  const { code, expiresIn } = data;

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ERJCHAT - 邮箱验证码</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 30px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .header p {
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 16px;
      color: #333;
      margin-bottom: 20px;
    }
    .code-section {
      background: #f8f9fa;
      border: 2px dashed #667eea;
      border-radius: 8px;
      padding: 30px;
      text-align: center;
      margin: 30px 0;
    }
    .code-label {
      font-size: 14px;
      color: #666;
      margin-bottom: 10px;
    }
    .code {
      font-size: 36px;
      font-weight: bold;
      color: #667eea;
      letter-spacing: 8px;
      font-family: 'Courier New', Courier, monospace;
    }
    .code-hint {
      font-size: 12px;
      color: #999;
      margin-top: 10px;
    }
    .tips {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .tips-title {
      font-weight: 600;
      color: #856404;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .tips-list {
      font-size: 13px;
      color: #856404;
      line-height: 1.8;
      padding-left: 20px;
    }
    .footer {
      background: #f8f9fa;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e9ecef;
    }
    .footer-text {
      font-size: 13px;
      color: #6c757d;
      line-height: 1.8;
    }
    .footer-text a {
      color: #667eea;
      text-decoration: none;
    }
    .footer-text a:hover {
      text-decoration: underline;
    }
    .divider {
      height: 1px;
      background: #e9ecef;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>ERJCHAT</h1>
      <p>智能AI聊天平台 - 邮箱验证</p>
    </div>

    <!-- Content -->
    <div class="content">
      <div class="greeting">
        您好！
      </div>

      <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
        感谢您使用 ERJCHAT！为了确保您的账户安全，请使用以下验证码完成邮箱验证。
      </p>

      <!-- Verification Code -->
      <div class="code-section">
        <div class="code-label">您的验证码</div>
        <div class="code">${code}</div>
        <div class="code-hint">验证码有效期为 ${expiresIn} 分钟</div>
      </div>

      <!-- Tips -->
      <div class="tips">
        <div class="tips-title">安全提示</div>
        <ul class="tips-list">
          <li>验证码仅用于本次邮箱验证，请勿泄露给他人</li>
          <li>ERJCHAT 工作人员不会向您索要验证码</li>
          <li>如果这不是您本人的操作，请忽略此邮件</li>
        </ul>
      </div>

      <div class="divider"></div>

      <p style="font-size: 13px; color: #999; margin-top: 20px;">
        如有任何疑问，欢迎联系我们的客服团队。
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-text">
        <p>此邮件由系统自动发送，请勿直接回复</p>
        <p style="margin-top: 10px;">
          © 2025 ERJCHAT. All rights reserved.
        </p>
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
export function getEmailVerificationTextTemplate(data: EmailVerificationTemplateData): string {
  const { code, expiresIn } = data;

  return `
ERJCHAT - 邮箱验证码

您好！

感谢您使用 ERJCHAT！为了确保您的账户安全，请使用以下验证码完成邮箱验证。

验证码：${code}
有效期：${expiresIn} 分钟

安全提示：
- 验证码仅用于本次邮箱验证，请勿泄露给他人
- ERJCHAT 工作人员不会向您索要验证码
- 如果这不是您本人的操作，请忽略此邮件

如有任何疑问，欢迎联系我们的客服团队。

此邮件由系统自动发送，请勿直接回复。

© 2025 ERJCHAT. All rights reserved.
  `.trim();
}

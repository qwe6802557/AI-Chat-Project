/**
 * Trace 载荷脱敏与字节长度截断工具
 * 防止密钥、Token 或大体积多模态 Base64 图片膨胀数据库体积
 */

const SENSITIVE_KEY_PATTERN =
  /("?(?:api[-_]?key|secret|token|password|authorization|credentials|appSecret|botToken)"?\s*[:=]\s*)"([^"]{4,})"/gi;
const BEARER_PATTERN = /(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi;
const SK_TOKEN_PATTERN = /\bsk-[A-Za-z0-9_-]{8,}\b/g;
const DATA_IMAGE_PATTERN =
  /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/g;

/**
 * 脱敏字符串中的密钥、Authorization 头及 Base64 图片
 */
export function maskSensitiveText(raw: string): string {
  return raw
    .replace(DATA_IMAGE_PATTERN, '[base64-image-omitted]')
    .replace(BEARER_PATTERN, '$1[REDACTED]')
    .replace(SK_TOKEN_PATTERN, 'sk-[REDACTED]')
    .replace(SENSITIVE_KEY_PATTERN, '$1"[REDACTED]"');
}

/**
 * 按字节长度安全截断字符串
 */
export function truncateUtf8ByBytes(text: string, maxBytes = 1024): string {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) {
    return text;
  }

  let low = 0;
  let high = text.length;
  const suffix = '...[truncated]';
  const budget = Math.max(32, maxBytes - Buffer.byteLength(suffix, 'utf8'));

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(text.slice(0, mid), 'utf8') <= budget) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return `${text.slice(0, low)}${suffix}`;
}

/**
 * 将任意上下文输入输出转为脱敏且定长的摘要文本（默认 <= 1KB）
 */
export function summarizeTracePayload(
  payload: unknown,
  maxBytes = 1024,
): string | null {
  if (payload === undefined || payload === null) {
    return null;
  }

  let serialized = '';
  if (typeof payload === 'string') {
    serialized = payload;
  } else {
    try {
      serialized = JSON.stringify(payload) ?? '';
    } catch {
      serialized = '[unserializable-payload]';
    }
  }

  const trimmed = serialized.trim();
  if (!trimmed) {
    return null;
  }

  return truncateUtf8ByBytes(maskSensitiveText(trimmed), maxBytes);
}

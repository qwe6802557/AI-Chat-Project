/**
 * 将数值向量校验并序列化为 pgvector 参数字面量
 */
export function toPgVectorLiteral(vector: number[]): string {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error('向量不能为空，无法构造 pgvector 字面量');
  }

  for (let i = 0; i < vector.length; i++) {
    if (!Number.isFinite(vector[i])) {
      throw new Error(`向量第 ${i} 维包含非法数值，无法写入 pgvector`);
    }
  }

  return `[${vector.join(',')}]`;
}

/**
 * 转义 PostgreSQL LIKE/ILIKE 模式中的通配符
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&');
}

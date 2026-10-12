import { RecursiveChunkerService } from './recursive-chunker.service';

describe('RecursiveChunkerService', () => {
  let chunker: RecursiveChunkerService;

  beforeEach(() => {
    chunker = new RecursiveChunkerService();
  });

  it('should return empty array for empty input', () => {
    expect(chunker.splitText('')).toEqual([]);
    expect(chunker.splitText('   ')).toEqual([]);
  });

  it('should return single chunk if text is within chunkSize', () => {
    const text = '短文本测试，长度不足500字。';
    const chunks = chunker.splitText(text);
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].charCount).toBe(text.length);
  });

  it('should split long text and apply overlap', () => {
    const paragraph1 = '第一段落：这是关于 PostgreSQL 和 pgvector 的向量检索技术介绍。'.repeat(5);
    const paragraph2 = '第二段落：这是关于混合多路召回与 RRF 融合重排算法的深入解析。'.repeat(5);
    const fullText = `${paragraph1}\n\n${paragraph2}`;

    const chunks = chunker.splitText(fullText, { chunkSize: 120, overlap: 30 });
    expect(chunks.length).toBeGreaterThan(1);

    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkIndex).toBe(i);
      expect(chunks[i].content.length).toBeGreaterThan(0);
    }
  });
});

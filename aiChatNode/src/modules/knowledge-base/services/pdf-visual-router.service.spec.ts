import { createCanvas } from '@napi-rs/canvas';
import { PdfVisualRouterService } from './pdf-visual-router.service';

function buildMinimalPdfBuffer(pageBodyStream: string): Buffer {
  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(pageBodyStream, 'utf8')} >>\nstream\n${pageBodyStream}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

/** 构造含第 1 页纯文本 + 第 2 页嵌入式 JPEG 图表的双页图文混排 PDF */
function buildMixedTextAndEmbeddedJpegPdfBuffer(): Buffer {
  const imgCanvas = createCanvas(200, 120);
  const ctx = imgCanvas.getContext('2d');
  ctx.fillStyle = '#2563EB';
  ctx.fillRect(10, 10, 180, 100);
  const jpegBuffer = imgCanvas.toBuffer('image/jpeg', 90);

  const page1Stream = [
    'BT /F1 12 Tf 40 740 Td',
    '(Nebula Multimodal Gateway v2.4 Architecture Specification for Production Verification.) Tj',
    '0 -20 Td (Rate Limit Threshold 3500 QPS and Circuit Breaker Timeout 1800ms in cn-shanghai.) Tj',
    'ET',
  ].join('\n');
  const page1Buf = Buffer.from(page1Stream, 'ascii');

  const page2Stream = [
    'BT /F1 14 Tf 40 740 Td (Page 2 Embedded Chart) Tj ET',
    'q 200 0 0 120 40 560 cm /Im1 Do Q',
  ].join('\n');
  const page2Buf = Buffer.from(page2Stream, 'ascii');

  const objects: Array<{ id: number; buf: Buffer }> = [];
  const addObj = (id: number, body: Buffer) => {
    objects.push({
      id,
      buf: Buffer.concat([
        Buffer.from(`${id} 0 obj\n`, 'ascii'),
        body,
        Buffer.from('\nendobj\n', 'ascii'),
      ]),
    });
  };

  addObj(1, Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'ascii'));
  addObj(
    2,
    Buffer.from('<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>', 'ascii'),
  );
  addObj(
    3,
    Buffer.from(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
      'ascii',
    ),
  );
  addObj(
    4,
    Buffer.from(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> /XObject << /Im1 8 0 R >> >> /Contents 7 0 R >>',
      'ascii',
    ),
  );
  addObj(
    5,
    Buffer.from(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      'ascii',
    ),
  );
  addObj(
    6,
    Buffer.concat([
      Buffer.from(`<< /Length ${page1Buf.length} >>\nstream\n`, 'ascii'),
      page1Buf,
      Buffer.from('\nendstream', 'ascii'),
    ]),
  );
  addObj(
    7,
    Buffer.concat([
      Buffer.from(`<< /Length ${page2Buf.length} >>\nstream\n`, 'ascii'),
      page2Buf,
      Buffer.from('\nendstream', 'ascii'),
    ]),
  );
  addObj(
    8,
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width 200 /Height 120 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBuffer.length} >>\nstream\n`,
        'ascii',
      ),
      jpegBuffer,
      Buffer.from('\nendstream', 'ascii'),
    ]),
  );

  const chunks: Buffer[] = [];
  const header = Buffer.from('%PDF-1.4\n', 'ascii');
  chunks.push(header);
  let offset = header.length;
  const offsets = new Map<number, number>();
  for (const obj of objects) {
    offsets.set(obj.id, offset);
    chunks.push(obj.buf);
    offset += obj.buf.length;
  }

  const xrefOffset = offset;
  const xrefLines = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f '];
  for (let i = 1; i <= objects.length; i++) {
    xrefLines.push(`${String(offsets.get(i)).padStart(10, '0')} 00000 n `);
  }
  const trailer = [
    ...xrefLines,
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
    '',
  ].join('\n');
  chunks.push(Buffer.from(trailer, 'ascii'));

  return Buffer.concat(chunks);
}

describe('PdfVisualRouterService', () => {
  let service: PdfVisualRouterService;
  let mockConfigService: any;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };
    service = new PdfVisualRouterService(mockConfigService);
  });

  it('根据文本字数、图片算子与矢量绘图算子准确区分纯文本页与视觉页', () => {
    expect(
      PdfVisualRouterService.shouldRenderPageAsVisual({
        textLength: 420,
        imageOpCount: 0,
        vectorDrawOpCount: 4,
      }),
    ).toBe(false);

    expect(
      PdfVisualRouterService.shouldRenderPageAsVisual({
        textLength: 25,
        imageOpCount: 0,
        vectorDrawOpCount: 0,
      }),
    ).toBe(true);

    expect(
      PdfVisualRouterService.shouldRenderPageAsVisual({
        textLength: 500,
        imageOpCount: 1,
        vectorDrawOpCount: 0,
      }),
    ).toBe(true);

    expect(
      PdfVisualRouterService.shouldRenderPageAsVisual({
        textLength: 350,
        imageOpCount: 0,
        vectorDrawOpCount: 75,
      }),
    ).toBe(true);
  });

  it('端到端解析真实 PDF Buffer：纯文本页跳过渲染，少字图表页栅格化为 PNG', async () => {
    const line1 =
      'Enterprise RAG Architecture Guide with pgvector HNSW iterative scan';
    const line2 =
      'and BGE reranker verification across multi-tenant knowledge collections.';
    const textOnlyPdf = buildMinimalPdfBuffer(
      `BT /F1 12 Tf 20 720 Td (${line1}) Tj 0 -20 Td (${line2}) Tj ET`,
    );

    const textResult = await service.inspectAndRenderPages(textOnlyPdf);
    expect(textResult.totalPages).toBe(1);
    expect(textResult.visualPagesDetected).toBe(0);
    expect(textResult.visualPagesRendered).toBe(0);
    expect(textResult.pages[0].isVisualPage).toBe(false);
    expect(textResult.pages[0].renderedPngBuffer).toBeUndefined();
    expect(textResult.pages[0].text).toContain('Enterprise RAG Architecture');

    const chartPdf = buildMinimalPdfBuffer(
      '0.15 0.39 0.92 rg 40 40 120 80 re f BT /F1 12 Tf 40 150 Td (Chart 1) Tj ET',
    );
    const chartResult = await service.inspectAndRenderPages(chartPdf);
    expect(chartResult.totalPages).toBe(1);
    expect(chartResult.visualPagesDetected).toBe(1);
    expect(chartResult.visualPagesRendered).toBe(1);
    expect(chartResult.pages[0].isVisualPage).toBe(true);
    expect(chartResult.pages[0].renderedPngBuffer).toBeDefined();
    expect(
      chartResult.pages[0].renderedPngBuffer!.subarray(0, 4).toString('hex'),
    ).toBe('89504e47');

    const cappedResult = await service.inspectAndRenderPages(chartPdf, {
      maxVisualPages: 0,
    });
    expect(cappedResult.visualPagesDetected).toBe(1);
    expect(cappedResult.visualPagesRendered).toBe(0);
    expect(cappedResult.visualPagesSkippedByCap).toBe(1);
    expect(cappedResult.pages[0].renderedPngBuffer).toBeUndefined();
  });

  it('含嵌入式 JPEG XObject 的图文混排 PDF 应复用 @napi-rs/canvas 工厂完成渲染，不依赖原生 node-canvas', async () => {
    const mixedPdf = buildMixedTextAndEmbeddedJpegPdfBuffer();
    const result = await service.inspectAndRenderPages(mixedPdf);

    expect(result.totalPages).toBe(2);
    expect(result.visualPagesDetected).toBe(1);
    expect(result.visualPagesRendered).toBe(1);

    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].isVisualPage).toBe(false);
    expect(result.pages[0].renderedPngBuffer).toBeUndefined();
    expect(result.pages[0].text).toContain('Nebula Multimodal Gateway v2.4');

    expect(result.pages[1].pageNumber).toBe(2);
    expect(result.pages[1].metrics.imageOpCount).toBeGreaterThanOrEqual(1);
    expect(result.pages[1].isVisualPage).toBe(true);
    expect(result.pages[1].renderedPngBuffer).toBeDefined();
    expect(
      result.pages[1].renderedPngBuffer!.subarray(0, 4).toString('hex'),
    ).toBe('89504e47');
  });
});

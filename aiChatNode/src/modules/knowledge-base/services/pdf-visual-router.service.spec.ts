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
});

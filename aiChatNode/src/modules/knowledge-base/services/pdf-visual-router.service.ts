import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCanvas,
  DOMMatrix as NapiDOMMatrix,
  ImageData as NapiImageData,
  Path2D as NapiPath2D,
} from '@napi-rs/canvas';
import path from 'node:path';

export interface PdfPageMetrics {
  textLength: number;
  imageOpCount: number;
  vectorDrawOpCount: number;
}

export interface PdfRoutedPage {
  pageNumber: number;
  text: string;
  isVisualPage: boolean;
  metrics: PdfPageMetrics;
  renderedPngBuffer?: Buffer;
}

export interface PdfVisualRouteResult {
  totalPages: number;
  visualPagesDetected: number;
  visualPagesRendered: number;
  visualPagesSkippedByCap: number;
  pages: PdfRoutedPage[];
}

class NodeCanvasFactory {
  create(width: number, height: number) {
    const safeWidth = Math.max(1, Math.ceil(width));
    const safeHeight = Math.max(1, Math.ceil(height));
    const canvas = createCanvas(safeWidth, safeHeight);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }

  reset(canvasAndContext: { canvas: any; context: any }, width: number, height: number) {
    canvasAndContext.canvas.width = Math.max(1, Math.ceil(width));
    canvasAndContext.canvas.height = Math.max(1, Math.ceil(height));
  }

  destroy(canvasAndContext: { canvas: any; context: any }) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

/**
 * PDF 逐页算子探测与视觉页按需栅格化路由服务
 */
@Injectable()
export class PdfVisualRouterService {
  private readonly logger = new Logger(PdfVisualRouterService.name);
  private static readonly MIN_TEXT_CHARS_FOR_TEXT_ONLY = 80;
  private static readonly MIN_VECTOR_OPS_FOR_DIAGRAM = 60;
  private static readonly DEFAULT_MAX_VISUAL_PAGES = 20;
  private static readonly DEFAULT_RENDER_SCALE = 1.5;

  constructor(private readonly configService: ConfigService) {}

  /**
   * 依据页面字符密度、光栅图绘制算子与矢量路径算子判定是否需要视觉解析
   */
  static shouldRenderPageAsVisual(metrics: PdfPageMetrics): boolean {
    if (metrics.textLength < PdfVisualRouterService.MIN_TEXT_CHARS_FOR_TEXT_ONLY) {
      return true;
    }
    if (metrics.imageOpCount >= 1) {
      return true;
    }
    return metrics.vectorDrawOpCount >= PdfVisualRouterService.MIN_VECTOR_OPS_FOR_DIAGRAM;
  }

  private resolveMaxVisualPages(override?: number): number {
    if (typeof override === 'number' && override >= 0) {
      return Math.floor(override);
    }
    const raw =
      this.configService.get<string>('KNOWLEDGE_MAX_PDF_VISION_PAGES') ||
      process.env.KNOWLEDGE_MAX_PDF_VISION_PAGES;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
    return PdfVisualRouterService.DEFAULT_MAX_VISUAL_PAGES;
  }

  private loadPdfJs(): any {
    const g = globalThis as Record<string, unknown>;
    if (!g.DOMMatrix) g.DOMMatrix = NapiDOMMatrix;
    if (!g.Path2D) g.Path2D = NapiPath2D;
    if (!g.ImageData) g.ImageData = NapiImageData;

    // 使用 pdfjs-dist v3 legacy CJS 构建以兼容 NestJS CommonJS 与 Jest 运行环境
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve(
      'pdfjs-dist/legacy/build/pdf.worker.js',
    );
    return pdfjsLib;
  }

  /**
   * 逐页提取 PDF 文本并仅对图表/扫描/少字页执行 Canvas 栅格化
   */
  async inspectAndRenderPages(
    buffer: Buffer,
    options?: { maxVisualPages?: number; scale?: number },
  ): Promise<PdfVisualRouteResult> {
    const pdfjsLib = this.loadPdfJs();
    const maxVisualPages = this.resolveMaxVisualPages(options?.maxVisualPages);
    const scale = options?.scale ?? PdfVisualRouterService.DEFAULT_RENDER_SCALE;
    const ops = pdfjsLib.OPS || {};

    const imageOps = new Set<number>(
      [
        ops.paintImageXObject,
        ops.paintInlineImageXObject,
        ops.paintJpegXObject,
        ops.paintImageXObjectRepeat,
      ].filter((v): v is number => typeof v === 'number'),
    );
    const vectorOps = new Set<number>(
      [
        ops.stroke,
        ops.closeStroke,
        ops.fill,
        ops.eoFill,
        ops.fillStroke,
        ops.eoFillStroke,
        ops.closeFillStroke,
        ops.closeEOFillStroke,
        ops.constructPath,
      ].filter((v): v is number => typeof v === 'number'),
    );

    const standardFontDataUrl = `${path.dirname(
      require.resolve('pdfjs-dist/package.json'),
    )}/standard_fonts/`;

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
      useSystemFonts: true,
      standardFontDataUrl,
      verbosity: 0,
    });

    const pdfDocument = await loadingTask.promise;
    const totalPages: number = pdfDocument.numPages || 0;
    const pages: PdfRoutedPage[] = [];
    const canvasFactory = new NodeCanvasFactory();

    let visualPagesDetected = 0;
    let visualPagesRendered = 0;
    let visualPagesSkippedByCap = 0;

    try {
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        const page = await pdfDocument.getPage(pageNumber);
        try {
          const textContent = await page.getTextContent({
            normalizeWhitespace: false,
            disableCombineTextItems: false,
          });
          const text = this.extractCleanPageText(textContent?.items || []);

          const opList = await page.getOperatorList();
          let imageOpCount = 0;
          let vectorDrawOpCount = 0;
          for (const fnId of opList?.fnArray || []) {
            if (imageOps.has(fnId)) imageOpCount += 1;
            else if (vectorOps.has(fnId)) vectorDrawOpCount += 1;
          }

          const metrics: PdfPageMetrics = {
            textLength: text.length,
            imageOpCount,
            vectorDrawOpCount,
          };
          const isVisualPage =
            PdfVisualRouterService.shouldRenderPageAsVisual(metrics);

          let renderedPngBuffer: Buffer | undefined;
          if (isVisualPage) {
            visualPagesDetected += 1;
            if (visualPagesRendered < maxVisualPages) {
              renderedPngBuffer = await this.renderPageToPng(
                page,
                canvasFactory,
                scale,
              );
              visualPagesRendered += 1;
            } else {
              visualPagesSkippedByCap += 1;
            }
          }

          pages.push({
            pageNumber,
            text,
            isVisualPage,
            metrics,
            renderedPngBuffer,
          });
        } finally {
          page.cleanup?.();
        }
      }
    } finally {
      await pdfDocument.destroy();
    }

    if (visualPagesSkippedByCap > 0) {
      this.logger.warn(
        `PDF 视觉页数量达到上限 (${maxVisualPages})，已跳过额外 ${visualPagesSkippedByCap} 页视觉渲染，保留其纯文本抽取`,
      );
    }

    return {
      totalPages,
      visualPagesDetected,
      visualPagesRendered,
      visualPagesSkippedByCap,
      pages,
    };
  }

  private extractCleanPageText(items: any[]): string {
    let lastY: number | undefined;
    let rawText = '';

    for (const item of items) {
      const y = Array.isArray(item?.transform) ? item.transform[5] : undefined;
      if (lastY === undefined || lastY === y) {
        rawText += item?.str || '';
      } else {
        rawText += `\n${item?.str || ''}`;
      }
      lastY = y;
    }

    return rawText
      .replace(/\0/g, '')
      .replace(/[\r\n]{3,}/g, '\n\n')
      .trim();
  }

  private async renderPageToPng(
    page: any,
    canvasFactory: NodeCanvasFactory,
    scale: number,
  ): Promise<Buffer> {
    const viewport = page.getViewport({ scale });
    const canvasAndContext = canvasFactory.create(
      viewport.width,
      viewport.height,
    );

    try {
      // 预填白底，避免透明背景 PDF 图表渲染为全黑底色
      canvasAndContext.context.fillStyle = '#FFFFFF';
      canvasAndContext.context.fillRect(
        0,
        0,
        canvasAndContext.canvas.width,
        canvasAndContext.canvas.height,
      );

      await page.render({
        canvasContext: canvasAndContext.context,
        viewport,
        canvasFactory,
      }).promise;

      return canvasAndContext.canvas.toBuffer('image/png');
    } finally {
      canvasFactory.destroy(canvasAndContext);
    }
  }
}

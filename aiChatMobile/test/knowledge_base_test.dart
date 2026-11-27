import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/features/knowledge_base/domain/knowledge_base_model.dart';
import 'package:ai_chat_mobile/features/knowledge_base/domain/document_model.dart';
import 'package:ai_chat_mobile/features/knowledge_base/domain/chunk_model.dart';
import 'package:ai_chat_mobile/features/knowledge_base/providers/knowledge_base_providers.dart';
import 'package:ai_chat_mobile/features/knowledge_base/presentation/widgets/knowledge_base_card.dart';
import 'package:ai_chat_mobile/features/knowledge_base/presentation/widgets/document_item_tile.dart';
import 'package:ai_chat_mobile/features/knowledge_base/presentation/widgets/document_upload_stream_card.dart';
import 'package:ai_chat_mobile/features/knowledge_base/presentation/widgets/highlighted_chunk_text.dart';
import 'package:ai_chat_mobile/features/knowledge_base/presentation/widgets/chunk_visual_preview_card.dart';

void main() {
  group('KnowledgeBaseModel Serialization Tests', () {
    test('正确解析标准 JSON 字段与默认值', () {
      final json = {
        'id': 'kb-001',
        'name': 'DeepTech架构白皮书',
        'description': '移动端与服务端核心技术方案',
        'avatar': 'memory',
        'status': 'active',
        'documentCount': 12,
        'chunkCount': 358,
        'createdAt': '2026-10-16T10:00:00Z',
        'updatedAt': '2026-10-16T10:30:00Z',
      };

      final kb = KnowledgeBaseModel.fromJson(json);

      expect(kb.id, 'kb-001');
      expect(kb.name, 'DeepTech架构白皮书');
      expect(kb.description, '移动端与服务端核心技术方案');
      expect(kb.avatar, 'memory');
      expect(kb.status, 'active');
      expect(kb.isActive, true);
      expect(kb.documentCount, 12);
      expect(kb.chunkCount, 358);
      expect(kb.createdAt, isNotNull);
      expect(kb.updatedAt, isNotNull);

      final outJson = kb.toJson();
      expect(outJson['id'], 'kb-001');
      expect(outJson['documentCount'], 12);
    });

    test('copyWith 正确局部替换属性', () {
      const kb = KnowledgeBaseModel(
        id: 'kb-002',
        name: '初始名称',
        description: '初始描述',
      );

      final updated = kb.copyWith(name: '更新名称', documentCount: 5);
      expect(updated.id, 'kb-002');
      expect(updated.name, '更新名称');
      expect(updated.description, '初始描述');
      expect(updated.documentCount, 5);
    });
  });

  group('DocumentModel Formatting & Status Tests', () {
    test('文件体积正确格式化为 B, KB, MB', () {
      const docBytes = DocumentModel(
        id: 'd1',
        knowledgeBaseId: 'kb1',
        title: '小文件',
        fileName: 'small.txt',
        fileType: 'txt',
        fileSize: 512,
      );
      expect(docBytes.formattedSize, '512 B');

      const docKb = DocumentModel(
        id: 'd2',
        knowledgeBaseId: 'kb1',
        title: '中型文件',
        fileName: 'medium.md',
        fileType: 'md',
        fileSize: 1024 * 45,
      );
      expect(docKb.formattedSize, '45.0 KB');

      const docMb = DocumentModel(
        id: 'd3',
        knowledgeBaseId: 'kb1',
        title: '大型研报',
        fileName: 'report.pdf',
        fileType: 'pdf',
        fileSize: 1024 * 1024 * 3 + 512000,
      );
      expect(docMb.formattedSize, '3.5 MB');
    });

    test('解析状态计算准确 (completed, processing, failed)', () {
      const docPending = DocumentModel(
        id: 'p1',
        knowledgeBaseId: 'kb1',
        title: '排队中',
        fileName: 'p.txt',
        fileType: 'txt',
        status: 'pending',
      );
      expect(docPending.isProcessing, true);
      expect(docPending.isCompleted, false);

      const docDone = DocumentModel(
        id: 'p2',
        knowledgeBaseId: 'kb1',
        title: '已完成',
        fileName: 'p.txt',
        fileType: 'txt',
        status: 'completed',
      );
      expect(docDone.isCompleted, true);
      expect(docDone.isProcessing, false);

      const docFailed = DocumentModel(
        id: 'p3',
        knowledgeBaseId: 'kb1',
        title: '解析失败',
        fileName: 'p.txt',
        fileType: 'txt',
        status: 'failed',
      );
      expect(docFailed.isFailed, true);
    });
  });

  group('ChunkModel & UploadProgressState Tests', () {
    test('ChunkModel 相似度得分与元数据解析', () {
      final json = {
        'id': 'chk-01',
        'knowledgeBaseId': 'kb-01',
        'documentId': 'doc-01',
        'chunkIndex': 2,
        'content': 'Flutter 移动端混合检索架构设计',
        'charCount': 22,
        'similarity': 0.892,
      };

      final chunk = ChunkModel.fromJson(json);
      expect(chunk.id, 'chk-01');
      expect(chunk.chunkIndex, 2);
      expect(chunk.score, 0.892);
      expect(chunk.content, contains('Flutter 移动端'));
    });

    test('UploadProgressState 状态迁移', () {
      const state = UploadProgressState();
      expect(state.isUploading, false);
      expect(state.progress, 0.0);

      final next = state.copyWith(
        fileName: 'test.pdf',
        progress: 0.65,
        isUploading: true,
      );
      expect(next.fileName, 'test.pdf');
      expect(next.progress, 0.65);
      expect(next.isUploading, true);
    });
  });

  group('Knowledge Base Widget Tests', () {
    testWidgets('KnowledgeBaseCard 渲染标题与元数据并触发回调', (tester) async {
      bool tapped = false;
      const kb = KnowledgeBaseModel(
        id: 'test-kb-1',
        name: '测试知识库卡片',
        description: '用于验证 Widget 渲染',
        documentCount: 5,
        chunkCount: 120,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: KnowledgeBaseCard(
              knowledgeBase: kb,
              onTap: () => tapped = true,
              onEdit: () {},
              onDelete: () {},
            ),
          ),
        ),
      );

      expect(find.text('测试知识库卡片'), findsOneWidget);
      expect(find.text('用于验证 Widget 渲染'), findsOneWidget);
      expect(find.text('5 篇文档'), findsOneWidget);
      expect(find.text('120 切片'), findsOneWidget);

      await tester.tap(find.text('测试知识库卡片'));
      expect(tapped, true);
    });

    testWidgets('DocumentItemTile 显示就绪状态与点击响应', (tester) async {
      bool tapped = false;
      const doc = DocumentModel(
        id: 'doc-widget-1',
        knowledgeBaseId: 'kb-1',
        title: '测试规范.pdf',
        fileName: '测试规范.pdf',
        fileType: 'pdf',
        fileSize: 1024 * 100,
        status: 'completed',
        chunkCount: 8,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DocumentItemTile(
              document: doc,
              onTap: () => tapped = true,
              onDelete: () {},
            ),
          ),
        ),
      );

      expect(find.text('测试规范.pdf'), findsOneWidget);
      expect(find.text('就绪'), findsOneWidget);
      expect(find.text('8 个切片'), findsOneWidget);

      await tester.tap(find.text('测试规范.pdf'));
      expect(tapped, true);
    });

    testWidgets('DocumentUploadStreamCard 渲染上传百分比', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DocumentUploadStreamCard(
              fileName: 'architecture.pdf',
              progress: 0.72,
              isProcessing: false,
            ),
          ),
        ),
      );

      expect(find.text('architecture.pdf'), findsOneWidget);
      expect(find.text('正在推流上传文件... 72%'), findsOneWidget);
      expect(find.text('72%'), findsOneWidget);
    });

    test('DocumentModel 解析 stage/progress 与 DocumentProgressEvent SSE 事件', () {
      final doc = DocumentModel.fromJson({
        'id': 'doc-sse-1',
        'knowledgeBaseId': 'kb-1',
        'title': 'SSE白皮书',
        'fileName': 'sse.pdf',
        'fileType': 'pdf',
        'status': 'processing',
        'stage': 'embedding',
        'progress': 64,
        'processedChunks': 16,
        'totalChunks': 25,
      });

      expect(doc.isProcessing, isTrue);
      expect(doc.progress, 64);
      expect(doc.stageLabel, '向量化 16/25');

      final evt = DocumentProgressEvent.fromJson({
        'type': 'completed',
        'documentId': 'doc-sse-1',
        'knowledgeBaseId': 'kb-1',
        'status': 'completed',
        'stage': 'completed',
        'progress': 100,
        'chunkCount': 25,
        'charCount': 6400,
      });
      expect(evt.type, 'completed');
      expect(evt.progress, 100);
      expect(evt.chunkCount, 25);
    });

    testWidgets('DocumentItemTile 在解析中展示进度条，失败时展示错误信息与重试按钮', (tester) async {
      bool retried = false;
      const processingDoc = DocumentModel(
        id: 'doc-proc',
        knowledgeBaseId: 'kb-1',
        title: '长文档.pdf',
        fileName: '长文档.pdf',
        fileType: 'pdf',
        status: 'processing',
        stage: 'embedding',
        progress: 48,
        processedChunks: 12,
        totalChunks: 25,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DocumentItemTile(
              document: processingDoc,
              onTap: () {},
              onDelete: () {},
            ),
          ),
        ),
      );

      expect(find.text('向量化 12/25 48%'), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);

      const failedDoc = DocumentModel(
        id: 'doc-fail',
        knowledgeBaseId: 'kb-1',
        title: '失败文档.pdf',
        fileName: '失败文档.pdf',
        fileType: 'pdf',
        status: 'failed',
        stage: 'failed',
        errorMessage: 'Embedding 429',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DocumentItemTile(
              document: failedDoc,
              onTap: () {},
              onDelete: () {},
              onRetry: () => retried = true,
            ),
          ),
        ),
      );

      expect(find.text('失败'), findsOneWidget);
      expect(find.text('Embedding 429'), findsOneWidget);
      await tester.tap(find.byIcon(Icons.refresh_rounded));
      expect(retried, isTrue);
    });

    test('ChunkModel 支持搜索结果字段 (chunkId, highlights, hitSource) 与上下文模型解析', () {
      final searchJson = {
        'chunkId': 'chk-search-1',
        'knowledgeBaseId': 'kb-1',
        'documentId': 'doc-1',
        'documentTitle': '架构指南',
        'chunkIndex': 4,
        'content': '支持 BGE-Reranker 精排能力',
        'charCount': 19,
        'score': 0.91,
        'hitSource': 'hybrid',
        'rerankScore': 0.91,
        'rerankApplied': true,
        'matchedTerms': ['BGE-Reranker'],
        'highlights': [
          {'start': 3, 'end': 15, 'term': 'BGE-Reranker'},
        ],
      };

      final hit = ChunkModel.fromJson(searchJson);
      expect(hit.id, 'chk-search-1');
      expect(hit.documentTitle, '架构指南');
      expect(hit.hitSource, 'hybrid');
      expect(hit.rerankApplied, isTrue);
      expect(hit.highlights.length, 1);
      expect(hit.highlights.first.term, 'BGE-Reranker');

      final ctx = ChunkContextModel.fromJson({
        'document': {
          'id': 'doc-1',
          'knowledgeBaseId': 'kb-1',
          'title': '架构指南',
          'fileName': 'arch.md',
          'fileType': 'md',
          'chunkCount': 8,
          'charCount': 400,
        },
        'targetChunk': searchJson,
        'prevChunks': [
          {
            'id': 'chk-prev',
            'knowledgeBaseId': 'kb-1',
            'documentId': 'doc-1',
            'chunkIndex': 3,
            'content': '前文段落',
          },
        ],
        'nextChunks': [],
        'window': 1,
      });

      expect(ctx.document.chunkCount, 8);
      expect(ctx.prevChunks.first.chunkIndex, 3);
      expect(ctx.targetChunk.id, 'chk-search-1');
    });

    testWidgets('HighlightedChunkText 渲染高亮 TextSpan 片段', (tester) async {
      const content = '使用 PostgreSQL 与 BGE-M3 执行混合检索';
      final start = content.indexOf('BGE-M3');

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: HighlightedChunkText(
              content: content,
              highlights: [
                HighlightSpan(start: start, end: start + 6, term: 'BGE-M3'),
              ],
            ),
          ),
        ),
      );

      expect(find.textContaining('BGE-M3'), findsOneWidget);
      final richFinder = find.byType(SelectableText);
      expect(richFinder, findsOneWidget);
      final selectable = tester.widget<SelectableText>(richFinder);
      final children = selectable.textSpan?.children ?? [];
      expect(children.length, 3);
      expect((children[1] as TextSpan).text, 'BGE-M3');
      expect((children[1] as TextSpan).style?.fontWeight, FontWeight.w700);
    });

    test('DocumentModel 与 ChunkModel 正确解析多模态视觉解析阶段与相对资产地址', () {
      const doc = DocumentModel(
        id: 'doc-v',
        knowledgeBaseId: 'kb-1',
        title: '图表报告',
        fileName: 'report.pdf',
        fileType: 'pdf',
        status: 'processing',
        stage: 'vision_extracting',
        progress: 35,
        processedVisuals: 2,
        totalVisuals: 5,
      );
      expect(doc.stageLabel, '视觉解析 2/5');

      final chunk = ChunkModel.fromJson({
        'id': 'chk-vis-1',
        'knowledgeBaseId': 'kb-1',
        'documentId': 'doc-v',
        'chunkIndex': 1,
        'content': '系统架构图摘要',
        'chunkType': 'visual',
        'assetId': 'asset-1',
        'visualType': 'diagram',
        'pageNumber': 3,
        'visualAssetUrl': '/knowledge-bases/assets/asset-1?expires=999&signature=sig',
      });
      expect(chunk.chunkType, 'visual');
      expect(chunk.pageNumber, 3);
      expect(
        chunk.resolvedVisualAssetUrl,
        endsWith('/knowledge-bases/assets/asset-1?expires=999&signature=sig'),
      );

      final noSlashChunk = ChunkModel.fromJson({
        'id': 'chk-vis-2',
        'knowledgeBaseId': 'kb-1',
        'documentId': 'doc-v',
        'chunkIndex': 2,
        'content': '无前导斜杠路径测试',
        'visualAssetUrl': 'knowledge-bases/assets/asset-2?expires=999&signature=sig',
      });
      expect(
        noSlashChunk.resolvedVisualAssetUrl,
        endsWith('/knowledge-bases/assets/asset-2?expires=999&signature=sig'),
      );
      expect(
        noSlashChunk.resolvedVisualAssetUrl,
        startsWith('https://'),
      );
      expect(
        noSlashChunk.resolvedVisualAssetUrl!.contains('siteknowledge-bases'),
        isFalse,
      );

      const blankChunk = ChunkModel(
        id: 'chk-vis-3',
        knowledgeBaseId: 'kb-1',
        documentId: 'doc-v',
        chunkIndex: 3,
        content: '空白地址测试',
        visualAssetUrl: '   ',
      );
      expect(blankChunk.resolvedVisualAssetUrl, isNull);
    });

    testWidgets('ChunkVisualPreviewCard 渲染类型标签、页码徽章与视觉直连状态', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChunkVisualPreviewCard(
              imageUrl: 'https://example.com/chart.webp',
              visualType: 'chart',
              pageNumber: 7,
              visualInjected: true,
            ),
          ),
        ),
      );

      expect(find.text('数据图表'), findsOneWidget);
      expect(find.text('P.7'), findsOneWidget);
      expect(find.text('已直连视觉模型'), findsOneWidget);
      expect(find.text('放大'), findsOneWidget);
    });

    testWidgets('ChunkVisualPreviewCard 图片加载失败时展示中文兜底提示并隐藏放大入口', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChunkVisualPreviewCard(
              imageUrl: 'https://invalid.example.com/broken.webp',
              visualType: 'diagram',
              pageNumber: 2,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.broken_image_outlined), findsOneWidget);
      expect(find.text('视觉原图暂不可用'), findsOneWidget);
      expect(find.text('放大'), findsNothing);
    });

    testWidgets('DocumentItemTile 在窄屏下正确渲染 SSE vision_extracting 阶段且无溢出', (tester) async {
      const visionDoc = DocumentModel(
        id: 'doc-vision-sse',
        knowledgeBaseId: 'kb-1',
        title: '2026年第四季度全固态电池测试与分析报告.pdf',
        fileName: 'report.pdf',
        fileType: 'pdf',
        fileSize: 204800,
        status: 'processing',
        stage: 'vision_extracting',
        progress: 35,
        processedVisuals: 12,
        totalVisuals: 25,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 320.0,
              child: DocumentItemTile(
                document: visionDoc,
                onTap: () {},
                onDelete: () {},
              ),
            ),
          ),
        ),
      );

      expect(find.text('视觉解析 12/25 35%'), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}

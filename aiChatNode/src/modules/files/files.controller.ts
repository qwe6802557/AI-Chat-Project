import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilesService } from './files.service';

@ApiTags('文件附件')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * 上传图片（用于聊天附件）
   * - 最多 4 张
   * - 单张 <= 5MB
   * - 服务端会重编码 + 限制最长边 <= 2048
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('upload')
  @ApiOperation({
    summary: '上传聊天附件',
    description:
      '上传聊天图片附件。上传成功后请在聊天接口中通过 fileIds 引用，不再建议直接传 base64 文件。',
  })
  @ApiResponse({
    status: 200,
    description: '上传成功，返回带签名的附件访问 URL',
  })
  @UseInterceptors(
    FilesInterceptor('files', FilesService.MAX_FILES, {
      storage: memoryStorage(),
      limits: {
        files: FilesService.MAX_FILES,
        fileSize: FilesService.MAX_FILE_SIZE_BYTES,
      },
      fileFilter: (_req, file, cb) => {
        const allowedTypes: readonly string[] =
          FilesService.ALLOWED_IMAGE_MIME_TYPES;
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException(`不支持的文件类型: ${file.mimetype}`),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser('id') userId?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('请至少上传 1 张图片');
    }
    return this.filesService.saveUploadedImages(userId, files);
  }

  /**
   * 通过附件 id 获取文件（签名 URL 访问）
   */
  @Get(':id')
  @ApiOperation({
    summary: '获取附件文件',
    description:
      '通过签名 URL 读取附件。请求必须携带 expires 和 signature 查询参数。签名默认有效期由 FILE_URL_TTL_SECONDS 控制。',
  })
  @ApiQuery({
    name: 'expires',
    required: true,
    description: '签名过期时间（Unix 秒时间戳）',
    example: '1760000000',
  })
  @ApiQuery({
    name: 'signature',
    required: true,
    description: '基于附件 id 和 expires 生成的 HMAC SHA-256 签名',
  })
  @ApiResponse({
    status: 200,
    description: '附件读取成功',
  })
  @ApiResponse({
    status: 403,
    description: '签名无效或已过期',
  })
  @ApiResponse({
    status: 404,
    description: '附件不存在',
  })
  async getFile(
    @Param('id') id: string,
    @Query('expires') expires: string | undefined,
    @Query('signature') signature: string | undefined,
    @Res() res: Response,
  ) {
    return this.filesService.streamFileById(id, res, {
      expires,
      signature,
    });
  }
}

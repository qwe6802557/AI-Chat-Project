import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilesService } from './files.service';

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
  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', FilesService.MAX_FILES, {
      storage: memoryStorage(),
      limits: {
        files: FilesService.MAX_FILES,
        fileSize: FilesService.MAX_FILE_SIZE_BYTES,
      },
      fileFilter: (_req, file, cb) => {
        const allowedTypes: readonly string[] = FilesService.ALLOWED_IMAGE_MIME_TYPES;
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
    @Req() req: Request,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('请至少上传 1 张图片');
    }

    const userId = (req.user as any)?.id as string | undefined;
    return this.filesService.saveUploadedImages(userId, files);
  }

  /**
   * 通过附件 id 获取文件（公开访问，便于 <img src> 直接使用）
   */
  @Get(':id')
  async getFile(@Param('id') id: string, @Res() res: Response) {
    return this.filesService.streamFileById(id, res);
  }
}

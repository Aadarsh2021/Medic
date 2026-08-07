import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StorageService, FileCategory } from './storage.service';

@ApiTags('files')
@Controller('files')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @ApiOperation({ summary: 'Upload file under specific category with magic-bytes & Sharp validation' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: any,
    @Query('category') category: FileCategory,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException({
        success: false,
        error: { code: 'NO_FILE_PROVIDED', message: 'Please attach a file to upload.' },
      });
    }

    if (!category) {
      throw new BadRequestException({
        success: false,
        error: { code: 'CATEGORY_REQUIRED', message: 'Upload category query param is required.' },
      });
    }

    const fileRecord = await this.storageService.uploadFile(
      file.buffer,
      file.originalname,
      category,
      user,
    );

    return {
      success: true,
      data: fileRecord,
      message: 'File uploaded successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/download')
  @ApiOperation({ summary: 'Authorized download/retrieval of private files' })
  async downloadFile(
    @Param('id') fileId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const { buffer, fileMetadata } = await this.storageService.getFileWithAuthorization(fileId, user);

    res.setHeader('Content-Type', fileMetadata.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(fileMetadata.originalFilename)}"`,
    );
    res.setHeader('Cache-Control', 'private, max-age=3600');

    return res.send(buffer);
  }
}

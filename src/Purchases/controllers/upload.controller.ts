// src/Purchases/controllers/upload.controller.ts
import {
  Controller, Post, Param, UploadedFile,
  UseInterceptors, UseGuards, BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor }       from '@nestjs/platform-express';
import { diskStorage }           from 'multer';
import { AuthGuard }               from '@nestjs/passport';
import { extname, join }         from 'path';
import { existsSync, mkdirSync } from 'fs';

@UseGuards(AuthGuard('jwt'))
@Controller('businesses/:businessId/upload')
export class UploadController {

  @Post('invoice-scan')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'invoice-scans');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
        if (allowed.includes(extname(file.originalname).toLowerCase())) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Format non supporté. Acceptés : PDF, JPG, PNG, WEBP.') as any,
            false,
          );
        }
      },
    }),
  )
  uploadInvoiceScan(
    @Param('businessId', ParseUUIDPipe) _businessId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    return {
      url:      `/uploads/invoice-scans/${file.filename}`,
      filename: file.originalname,
      size:     file.size,
    };
  }
}
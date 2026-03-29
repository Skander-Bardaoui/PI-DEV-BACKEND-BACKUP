// src/Purchases/controllers/ocr.controller.ts
import {
  Controller, Post, UploadedFile, UseInterceptors,
  UseGuards, BadRequestException, Param, ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor }  from '@nestjs/platform-express';
import { diskStorage }      from 'multer';
import { extname, join }    from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AuthGuard }        from '@nestjs/passport';
import { OcrService } from '../services/ocr.service';

@UseGuards(AuthGuard('jwt'))
@Controller('businesses/:businessId/ocr')
export class OcrController {

  constructor(private readonly ocrService: OcrService) {}

  // POST /businesses/:bId/ocr/extract
  // Upload un fichier et extrait les données de la facture
  @Post('extract')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'ocr-temp');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo max
      fileFilter: (_req, file, cb) => {
        const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
        if (allowed.includes(extname(file.originalname).toLowerCase())) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Format non supporté. Utilisez PDF, JPG ou PNG.') as any, false);
        }
      },
    }),
  )
  async extractInvoice(
    @Param('businessId', ParseUUIDPipe) _businessId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');

    const result = await this.ocrService.extractFromFile(file.path);

    // Retourner aussi le chemin du fichier pour l'attacher à la facture
    return {
      ...result,
      file_url:  `/uploads/ocr-temp/${file.filename}`,
      file_name: file.originalname,
      file_size: file.size,
    };
  }
}
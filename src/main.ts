// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable cookie parsing
  app.use(cookieParser());

  // Serve static files (for uploaded avatars)
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:        true,              // supprime les champs non déclarés dans les DTOs
      forbidNonWhitelisted: false,         // ne rejette pas, supprime juste
      transform:        true,             // transforme automatiquement les types (string→number)
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        // Messages d'erreur structurés et lisibles
        const messages = errors.map(err => {
          const constraints = Object.values(err.constraints ?? {});
          return {
            field:    err.property,
            messages: constraints,
          };
        });
        return new BadRequestException({
          statusCode: 400,
          error:      'Validation échouée',
          details:    messages,
          // Premier message pour compatibilité avec l'ancien format
          message:    messages.flatMap(m => m.messages),
        });
      },
    }),
  );


  // Allow React dev server to hit this backend.
  // Vite defaults to port 5173. If yours is different, change it here.
  app.enableCors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  await app.listen(3001);
  console.log('Backend running on http://localhost:3001');
}

bootstrap();

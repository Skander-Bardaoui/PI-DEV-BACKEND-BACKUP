// src/main.ts
process.env.NODE_TLS_REJECT_UNAUTHORIZED =
  process.env.NODE_ENV !== 'production' ? '0' : undefined;
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ZodValidationPipe as NestJsZodValidationPipe } from 'nestjs-zod';
import helmet from 'helmet';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 🔐 Security: Helmet - Add security headers
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // Enable cookie parsing
  app.use(cookieParser());
  
  // Configure body parsing with raw body for Stripe webhook
  app.use((req, res, next) => {
    if (req.originalUrl === '/webhooks/stripe') {
      next();
    } else {
      require('express').json()(req, res, next);
    }
  });
  
  app.use((req, res, next) => {
    if (req.originalUrl === '/webhooks/stripe') {
      require('express').raw({ type: 'application/json' })(req, res, next);
    } else {
      next();
    }
  });
  
  app.use(require('express').urlencoded({ extended: true }));

  // Serve static files (for uploaded avatars and message files)
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/',
  });

  // Serve uploads folder for message files - use process.cwd() for reliability
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    setHeaders: (res) => {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.setHeader('Access-Control-Allow-Origin', frontendUrl);
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });

  // Configuration globale pour Zod et class-validator (compatibilité)
  app.useGlobalPipes(
    // Pipe Zod pour les DTOs qui utilisent nestjs-zod
    new NestJsZodValidationPipe(),
    // Pipe class-validator pour les anciens DTOs (rétrocompatibilité)
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


  // 🔐 Security: CORS - Restrict to specific origin
  const allowedOrigins = [
    'http://localhost:5173',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 3600, // Cache preflight requests for 1 hour
  });

  const port = process.env.PORT || 3001;

  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend running on port ${port}`);
}

bootstrap();

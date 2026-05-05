// src/platform-auth/strategies/platform-jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';
import { PlatformAdmin } from '../entities/platform-admin.entity';

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, 'platform-jwt') {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(PlatformAdmin)
    private readonly adminRepo: Repository<PlatformAdmin>,
  ) {
    const secret = configService.get<string>('PLATFORM_JWT_SECRET');
    if (!secret) {
      throw new Error('PLATFORM_JWT_SECRET is not defined in environment variables');
    }
    
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.platform_access_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any): Promise<PlatformAdmin> {
    const admin = await this.adminRepo.findOne({
      where: { id: payload.sub },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid platform admin token');
    }

    return admin;
  }
}

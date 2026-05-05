// src/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from './enums/role.enum';
import * as bcrypt from 'bcryptjs';

import * as fs from 'fs/promises';
import * as path from 'path';
import { UpdateProfileDto } from './dto/update-profile.dto';
import sharp from 'sharp';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // ─── Find Methods ─────────────────────────────────
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  // ─── Create User ─────────────────────────────────
  async create(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: Role;
  }): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = this.userRepository.create({
      email: data.email,
      password_hash: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || Role.TEAM_MEMBER,
    });

    return this.userRepository.save(user);
  }

  // ─── Update User ─────────────────────────────────
  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    await this.userRepository.update(id, userData);

    const updated = await this.findById(id);
    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return updated;
  }

  // ─── Update Profile ──────────────────────────────
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.jobTitle !== undefined) user.jobTitle = dto.jobTitle;
    if (dto.preferredLanguage !== undefined)
      user.preferredLanguage = dto.preferredLanguage;
    if (dto.timezone !== undefined) user.timezone = dto.timezone;

    return this.userRepository.save(user);
  }

  // ─── Change Password ─────────────────────────────
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValid = await bcrypt.compare(
      currentPassword,
      user.password_hash,
    );

    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.userRepository.update(userId, {
      password_hash: hashedPassword,
    });
  }

  // ─── Upload Avatar ───────────────────────────────
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const uploadsDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'avatars',
    );
    await fs.mkdir(uploadsDir, { recursive: true });

    const filename = `${userId}-${Date.now()}.webp`;
    const filepath = path.join(uploadsDir, filename);

    await sharp(file.buffer)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toFile(filepath);

    // delete old avatar
    if (user.avatarUrl) {
      try {
        await fs.unlink(
          path.join(process.cwd(), 'public', user.avatarUrl),
        );
      } catch {
        // Ignore if file doesn't exist
      }
    }

    const avatarUrl = `/uploads/avatars/${filename}`;

    await this.userRepository.update(userId, { avatarUrl });

    return avatarUrl;
  }

  // ─── Verify User ─────────────────────────────────
  async verify(id: string): Promise<void> {
    await this.userRepository.update(id, { is_verified: true });
  }

  // ─── Change Role ─────────────────────────────────
  async updateRole(id: string, role: Role): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    user.role = role;
    return this.userRepository.save(user);
  }

  // ─── List Users ──────────────────────────────────
  async findAll(
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<{ users: User[]; total: number }> {
    const skip = (page - 1) * limit;

    const where = search
      ? [
          { email: Like(`%${search}%`) },
          { firstName: Like(`%${search}%`) },
          { lastName: Like(`%${search}%`) },
        ]
      : {};

    const [users, total] = await this.userRepository.findAndCount({
      where,
      skip,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return { users, total };
  }

  // ─── Delete User ─────────────────────────────────
  async deleteUser(id: string): Promise<void> {
    const result = await this.userRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }
  }

  // ─── Suspend / Activate ──────────────────────────
  async suspend(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    user.is_suspended = true;
    return this.userRepository.save(user);
  }

  async activate(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    user.is_suspended = false;
    return this.userRepository.save(user);
  }
}
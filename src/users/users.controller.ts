// src/users/users.controller.ts
import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from './enums/role.enum';
import { ChangeRoleDto } from './dto/change-role.dto';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── GET /users/me ───────────────────────────────────────────────────────
  @Get('me')
  async getMyProfile(@Request() req) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  // ─── PATCH /users/me ─────────────────────────────────────────────────────
  @Patch('me')
  async updateMyProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    const updated = await this.usersService.updateProfile(req.user.id, dto);
    const { password_hash, ...safeUser } = updated;
    return safeUser;
  }

  // ─── POST /users/me/avatar ───────────────────────────────────────────────
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('avatar', {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max
    },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/^image\/(jpg|jpeg|png|gif|webp)$/)) {
        return cb(new BadRequestException('Only image files are allowed'), false);
      }
      cb(null, true);
    },
  }))
  async uploadAvatar(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const avatarUrl = await this.usersService.uploadAvatar(req.user.id, file);
    return { avatarUrl };
  }

  // ─── PATCH /users/me/password ────────────────────────────────────────────
  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Request() req, @Body() dto: ChangePasswordDto) {
    await this.usersService.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
    return { message: 'Password changed successfully' };
  }

  // ─── ADMIN: GET /users ───────────────────────────────────────────────────
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.PLATFORM_ADMIN)
  async findAll(@Query() query: QueryUsersDto) {
    const { users, total } = await this.usersService.findAll(
      query.page,
      query.limit,
      query.search,
    );

    // Don't send password_hash to frontend
    const safeUsers = users.map(({ password_hash, ...rest }) => rest);

    return {
      users: safeUsers,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  // ─── ADMIN: GET /users/:id ───────────────────────────────────────────────
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.PLATFORM_ADMIN)
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      return { message: 'User not found' };
    }

    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  // ─── ADMIN: PATCH /users/:id ─────────────────────────────────────────────
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.PLATFORM_ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const updated = await this.usersService.updateUser(id, dto);
    const { password_hash, ...safeUser } = updated;
    return safeUser;
  }

  // ─── ADMIN: DELETE /users/:id ────────────────────────────────────────────
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    await this.usersService.deleteUser(id);
    return { message: 'User deleted successfully' };
  }

  // ─── ADMIN: PATCH /users/:id/role ────────────────────────────────────────
  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(Role.PLATFORM_ADMIN)
  async changeRole(@Param('id') id: string, @Body() dto: ChangeRoleDto) {
    const updated = await this.usersService.updateRole(id, dto.role);
    const { password_hash, ...safeUser } = updated;
    return safeUser;
  }

  // ─── ADMIN: POST /users/:id/suspend ──────────────────────────────────────
  @Post(':id/suspend')
  @UseGuards(RolesGuard)
  @Roles(Role.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async suspend(@Param('id') id: string) {
    await this.usersService.suspend(id);
    return { message: 'User suspended successfully' };
  }

  // ─── ADMIN: POST /users/:id/activate ─────────────────────────────────────
  @Post(':id/activate')
  @UseGuards(RolesGuard)
  @Roles(Role.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string) {
    await this.usersService.activate(id);
    return { message: 'User activated successfully' };
  }
}
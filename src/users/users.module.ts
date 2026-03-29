// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller'; // ← Import the controller

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
   controllers: [UsersController], // ← Add this line
  exports: [UsersService],  // MUST export so AuthModule can inject it
})
export class UsersModule {}
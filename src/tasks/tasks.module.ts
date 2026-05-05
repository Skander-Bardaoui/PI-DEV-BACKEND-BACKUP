import { Module, forwardRef, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task } from './entities/task.entity';
import { User } from '../users/entities/user.entity';
import { BusinessesModule } from '../businesses/businesses.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, User]),
    ConfigModule,
    BusinessesModule,
    forwardRef(() => MessagesModule),
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
@Global()
export class TasksModule {}

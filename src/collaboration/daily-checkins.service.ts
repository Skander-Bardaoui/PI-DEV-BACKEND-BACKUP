import {
  Injectable,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyCheckin } from './entities/daily-checkin.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { Business } from '../businesses/entities/business.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Task } from './entities/task.entity';
import { Role } from '../users/enums/role.enum';
import { CreateCheckinDto } from './dto/create-checkin.dto';

@Injectable()
export class DailyCheckinsService {
  constructor(
    @InjectRepository(DailyCheckin)
    private checkinRepo: Repository<DailyCheckin>,

    @InjectRepository(BusinessMember)
    private memberRepo: Repository<BusinessMember>,

    @InjectRepository(Task)
    private taskRepo: Repository<Task>,

    @InjectRepository(Business)
    private businessRepo: Repository<Business>,

    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
  ) {}

  // ─── Verify business membership ────────────────────
  async hasAccess(userId: string, businessId: string): Promise<boolean> {
    const member = await this.memberRepo.findOne({
      where: { user_id: userId, business_id: businessId, is_active: true },
    });

    return !!member;
  }

  // ─── CREATE CHECK-IN ───────────────────────────────
  async createCheckin(dto: CreateCheckinDto, userId: string) {
    // Verify user is member of business
    const hasAccess = await this.hasAccess(userId, dto.businessId);
    if (!hasAccess) {
      throw new ForbiddenException('Not a member of this business');
    }

    // Verify user is TEAM_MEMBER or ACCOUNTANT
    const member = await this.memberRepo.findOne({
      where: { user_id: userId, business_id: dto.businessId },
      relations: ['user'],
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this business');
    }

    if (
      member.role !== Role.TEAM_MEMBER &&
      member.role !== Role.ACCOUNTANT
    ) {
      throw new ForbiddenException(
        'Only TEAM_MEMBER and ACCOUNTANT can submit check-ins',
      );
    }

    // Get today's date (without time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already checked in today
    const existing = await this.checkinRepo.findOne({
      where: {
        userId,
        checkinDate: today,
      },
    });

    if (existing) {
      throw new ConflictException('Already checked in today');
    }

    // Create check-in
    const checkin = this.checkinRepo.create({
      userId,
      businessId: dto.businessId,
      taskIds: dto.taskIds,
      note: dto.note || null,
      skipped: dto.skipped,
      checkinDate: today,
    });

    return this.checkinRepo.save(checkin);
  }

  // ─── CHECK IF USER CHECKED IN TODAY ────────────────
  async hasCheckedInToday(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkin = await this.checkinRepo.findOne({
      where: {
        userId,
        checkinDate: today,
      },
    });

    return { hasCheckedIn: !!checkin };
  }

  // ─── GET BUSINESS CHECK-INS FOR TODAY ──────────────
  async getBusinessCheckinsToday(businessId: string, userId: string) {
    console.log('🔍 Getting business checkins for:', { businessId, userId });
    
    // Verify user is member of business
    const hasAccess = await this.hasAccess(userId, businessId);
    if (!hasAccess) {
      throw new ForbiddenException('Not a member of this business');
    }

    // Get all team members and accountants
    const members = await this.memberRepo.find({
      where: { business_id: businessId },
      relations: ['user'],
    });

    console.log('👥 Total members found:', members.length);

    const teamMembers = members.filter(
      (m) =>
        m.role === Role.TEAM_MEMBER || m.role === Role.ACCOUNTANT,
    );

    console.log('👥 Team members/accountants:', teamMembers.length);

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's check-ins
    const checkins = await this.checkinRepo.find({
      where: {
        businessId,
        checkinDate: today,
      },
      relations: ['user'],
    });

    console.log('✅ Checkins found:', checkins.length);

    // Build response
    const result = await Promise.all(
      teamMembers.map(async (member) => {
        const checkin = checkins.find(
          (c) => c.userId === member.user_id,
        );

        let status: 'checked_in' | 'skipped' | 'pending';
        let tasks: any[] = [];
        let note: string | null = null;

        if (checkin) {
          status = checkin.skipped ? 'skipped' : 'checked_in';
          note = checkin.note;

          // Fetch task details if not skipped
          if (!checkin.skipped && checkin.taskIds.length > 0) {
            tasks = await this.taskRepo.find({
              where: checkin.taskIds.map((id) => ({ id })),
            });
          }
        } else {
          status = 'pending';
        }

        return {
          userId: member.user_id,
          firstName: member.user.firstName,
          lastName: member.user.lastName,
          avatarUrl: member.user.avatarUrl,
          status,
          tasks,
          note,
        };
      }),
    );

    // Calculate summary
    const summary = {
      checkedIn: result.filter((r) => r.status === 'checked_in').length,
      skipped: result.filter((r) => r.status === 'skipped').length,
      pending: result.filter((r) => r.status === 'pending').length,
    };

    console.log('📊 Summary:', summary);

    return {
      members: result,
      summary,
    };
  }
}
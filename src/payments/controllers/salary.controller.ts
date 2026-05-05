import {
  Controller, Get, Post, Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { IsString, IsNumber, IsOptional, IsIn, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SalaryService } from '../services/salary.service';
import { SalaryPermissionGuard } from '../guards/salary-permission.guard';
import { RequireSalaryPermission } from '../decorators/salary-permission.decorator';

// ─── DTOs ──────────────────────────────────────────────────────────────────────

class SendProposalDto {
  @IsString()  userId: string;
  @IsNumber() @Min(0) @Type(() => Number)  amount: number;
  @IsString()  currency: string;
  @IsOptional() @IsString()  message?: string;
  @IsString()  businessName: string;
}

class RespondProposalDto {
  @IsIn(['ACCEPT', 'REJECT', 'COUNTER'])  action: 'ACCEPT' | 'REJECT' | 'COUNTER';
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)  counterAmount?: number;
  @IsOptional() @IsString()  note?: string;
}

class PaySalaryDto {
  @IsString()
  accountId: string;

  @IsIn(['VIREMENT', 'CHEQUE', 'ESPECES', 'TRAITE', 'CARTE'])
  paymentMethod: string;

  @IsOptional()
  @IsString()
  stripePaymentIntentId?: string;
}

// ─── Controller ────────────────────────────────────────────────────────────────

@Controller('salary')
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  @Get(':businessId/members')
  @UseGuards(JwtAuthGuard)
  async getMembers(@Param('businessId') businessId: string) {
    const members = await this.salaryService.getBusinessMembers(businessId);
    return members.map((m) => ({
      id:       m.id,
      userId:   m.user_id,
      role:     m.role,
      isActive: m.is_active,
      joinedAt: m.joined_at,
      user: {
        id:        m.user.id,
        email:     m.user.email,
        firstName: m.user.firstName,
        lastName:  m.user.lastName,
        jobTitle:  m.user.jobTitle,
        avatarUrl: m.user.avatarUrl,
        role:      m.user.role,
      },
    }));
  }

  @Get(':businessId/proposal-statuses')
  @UseGuards(JwtAuthGuard)
  async getProposalStatuses(@Param('businessId') businessId: string) {
    return this.salaryService.getProposalStatuses(businessId);
  }

  @Get(':businessId/accepted-proposals')
  @UseGuards(JwtAuthGuard)
  async getAcceptedProposals(@Param('businessId') businessId: string) {
    const proposals = await this.salaryService.getAcceptedProposals(businessId);
    return proposals.map((p) => ({
      id:             p.id,
      recipientName:  p.recipient_name,
      recipientEmail: p.recipient_email,
      proposedAmount: Number(p.proposed_amount),
      currency:       p.currency,
      status:         p.status,
      respondedAt:    p.responded_at,
      paidAt:         p.paid_at,
      transactionId:  p.transaction_id,
    }));
  }

  @Post(':businessId/propose')
  @UseGuards(JwtAuthGuard, SalaryPermissionGuard)
  @RequireSalaryPermission('send_proposal')
  async sendProposal(
    @Param('businessId') businessId: string,
    @Body() dto: SendProposalDto,
    @Request() req: any,
  ) {
    const senderName =
      `${req.user?.firstName ?? req.user?.first_name ?? ''} ${req.user?.lastName ?? req.user?.last_name ?? ''}`.trim() ||
      req.user?.email || 'Manager';
    const senderEmail: string = req.user?.email ?? '';

    return this.salaryService.sendSalaryProposal(
      businessId,
      { userId: dto.userId, amount: dto.amount, currency: dto.currency || 'TND', message: dto.message },
      senderName,
      senderEmail,
      dto.businessName || 'Your Company',
    );
  }

  @Post(':businessId/pay/:proposalId')
  @UseGuards(JwtAuthGuard, SalaryPermissionGuard)
  @RequireSalaryPermission('pay_salary')
  async paySalary(
    @Param('businessId') businessId: string,
    @Param('proposalId') proposalId: string,
    @Body() dto: PaySalaryDto,
    @Request() req: any,
  ) {
  return this.salaryService.paySalary(
    businessId,
    proposalId,
    dto.accountId,
    req.user.id,
    dto.paymentMethod,
    dto.stripePaymentIntentId,
  );
}

  @Get('respond/:token')
  async getProposal(@Param('token') token: string) {
    const p = await this.salaryService.getProposalByToken(token);
    return {
      id:             p.id,
      recipientName:  p.recipient_name,
      senderName:     p.sender_name,
      businessName:   p.business_name,
      proposedAmount: Number(p.proposed_amount),
      counterAmount:  p.counter_amount ? Number(p.counter_amount) : null,
      currency:       p.currency,
      message:        p.message,
      responseNote:   p.response_note,
      status:         p.status,
      createdAt:      p.created_at,
      respondedAt:    p.responded_at,
    };
  }

  @Post('respond/:token')
  async respondToProposal(
    @Param('token') token: string,
    @Body() dto: RespondProposalDto,
  ) {
    return this.salaryService.respondToProposal(token, {
      action:        dto.action,
      counterAmount: dto.counterAmount,
      note:          dto.note,
    });
  }
}

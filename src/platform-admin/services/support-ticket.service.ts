// src/platform-admin/services/support-ticket.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket } from '../entities/support-ticket.entity';
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { UpdateTicketDto } from '../dto/update-ticket.dto';
import { TicketQueryDto } from '../dto/ticket-query.dto';
import { TicketReplyDto } from '../dto/ticket-reply.dto';
import { TicketStatus } from '../enums/ticket-status.enum';
import { EmailService } from '../../email/email.service';

@Injectable()
export class SupportTicketService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    private readonly emailService: EmailService,
  ) {}

  async createTicket(
    userId: string,
    tenantId: string,
    dto: CreateTicketDto,
  ): Promise<SupportTicket> {
    const ticket = this.ticketRepo.create({
      tenant_id: tenantId,
      submitted_by_id: userId,
      subject: dto.subject,
      body: dto.body,
      priority: dto.priority,
    });

    return this.ticketRepo.save(ticket);
  }

  async getTickets(query: TicketQueryDto) {
    const { status, priority, tenantId, assignedToId, page = 1, limit = 50 } = query;

    const qb = this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.tenant', 'tenant')
      .leftJoinAndSelect('ticket.submitted_by', 'submittedBy')
      .leftJoinAndSelect('ticket.assigned_to', 'assignedTo')
      .orderBy('ticket.created_at', 'DESC');

    if (status) {
      qb.andWhere('ticket.status = :status', { status });
    }

    if (priority) {
      qb.andWhere('ticket.priority = :priority', { priority });
    }

    if (tenantId) {
      qb.andWhere('ticket.tenant_id = :tenantId', { tenantId });
    }

    if (assignedToId) {
      qb.andWhere('ticket.assigned_to_id = :assignedToId', { assignedToId });
    }

    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const [tickets, total] = await qb.getManyAndCount();

    return {
      data: tickets,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateTicket(id: string, dto: UpdateTicketDto): Promise<SupportTicket> {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: ['tenant', 'submitted_by', 'assigned_to'],
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (dto.status) {
      ticket.status = dto.status;
      if (dto.status === TicketStatus.RESOLVED || dto.status === TicketStatus.CLOSED) {
        ticket.resolved_at = new Date();
      }
    }

    if (dto.priority) {
      ticket.priority = dto.priority;
    }

    if (dto.assigned_to_id !== undefined) {
      ticket.assigned_to_id = dto.assigned_to_id;
    }

    return this.ticketRepo.save(ticket);
  }

  async replyToTicket(id: string, adminEmail: string, dto: TicketReplyDto): Promise<void> {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: ['tenant', 'submitted_by'],
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Send email reply to ticket submitter
    const transporter = this.emailService['transporter'];
    await transporter.sendMail({
      from: `"NovEntra Support" <${process.env.GMAIL_USER}>`,
      to: ticket.submitted_by.email,
      subject: `Re: ${ticket.subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">Support Ticket Update</h2>
            <p style="color: #666;"><strong>Ticket ID:</strong> ${ticket.id}</p>
            <p style="color: #666;"><strong>Subject:</strong> ${ticket.subject}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <div style="color: #333; line-height: 1.6; white-space: pre-wrap;">${dto.message}</div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 13px;"><em>This is a reply from the NovEntra support team.</em></p>
          </div>
        </div>
      `,
    });

    // Update ticket status to in_progress if it was open
    if (ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.IN_PROGRESS;
      await this.ticketRepo.save(ticket);
    }
  }
}

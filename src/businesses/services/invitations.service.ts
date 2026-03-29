// src/businesses/services/invitations.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import { BusinessInvitation, InvitationStatus } from '../entities/business-invitation.entity';
import { Business } from '../entities/business.entity';
import { User } from '../../users/entities/user.entity';
import { BusinessMembersService } from './business-members.service';
import { Role } from '../../users/enums/role.enum';

@Injectable()
export class InvitationsService {
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(BusinessInvitation)
    private invitationRepository: Repository<BusinessInvitation>,
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private businessMembersService: BusinessMembersService,
    private configService: ConfigService,
  ) {
    // Initialize nodemailer transporter
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  /**
   * Send an invitation to join a business
   */
  async sendInvitation(
    businessId: string,
    email: string,
    role: Role,
    invitedBy: string,
  ): Promise<BusinessInvitation> {
    // Validate role
    if (
      ![
        Role.BUSINESS_ADMIN,
        Role.TEAM_MEMBER,
        Role.ACCOUNTANT,
      ].includes(role)
    ) {
      throw new BadRequestException(
        'Invalid role. Can only invite BUSINESS_ADMIN, TEAM_MEMBER, or ACCOUNTANT',
      );
    }

    // Verify business exists
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
      relations: ['tenant'],
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    // Check if user already exists and is already a member
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      const hasAccess = await this.businessMembersService.hasAccess(
        existingUser.id,
        businessId,
      );

      if (hasAccess) {
        throw new BadRequestException(
          'User is already a member of this business',
        );
      }
    }

    // Check for pending invitation
    const pendingInvitation = await this.invitationRepository.findOne({
      where: {
        business_id: businessId,
        email,
        status: InvitationStatus.PENDING,
      },
    });

    if (pendingInvitation) {
      throw new BadRequestException(
        'An invitation has already been sent to this email',
      );
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = this.invitationRepository.create({
      business_id: businessId,
      email,
      role,
      invited_by: invitedBy,
      token,
      expires_at: expiresAt,
      status: InvitationStatus.PENDING,
    });

    const saved = await this.invitationRepository.save(invitation);

    // Send email
    await this.sendInvitationEmail(saved, business);

    return saved;
  }

  /**
   * Get invitation by token
   */
  async getInvitationByToken(token: string): Promise<BusinessInvitation> {
    const invitation = await this.invitationRepository.findOne({
      where: { token },
      relations: ['business', 'inviter'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    // Check if expired
    if (new Date() > invitation.expires_at) {
      if (invitation.status === InvitationStatus.PENDING) {
        invitation.status = InvitationStatus.EXPIRED;
        await this.invitationRepository.save(invitation);
      }
      throw new BadRequestException('Invitation has expired');
    }

    return invitation;
  }

  /**
   * Accept an invitation and create user account (for new users)
   */
  async acceptInvitationWithRegistration(
    token: string,
    firstName: string,
    lastName: string,
    password: string,
    phone?: string,
  ): Promise<{ message: string; user: any }> {
    const invitation = await this.getInvitationByToken(token);

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is no longer valid');
    }

    // Check if user already exists with this email
    const existingUser = await this.userRepository.findOne({
      where: { email: invitation.email },
    });

    if (existingUser) {
      throw new BadRequestException(
        'An account with this email already exists. Please login instead.',
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = this.userRepository.create({
      email: invitation.email,
      firstName,
      lastName,
      phone,
      password_hash: hashedPassword,
      role: invitation.role,
      is_verified: true, // Auto-verify invited users
      is_suspended: false,
    });

    await this.userRepository.save(user);

    // Add user to business
    await this.businessMembersService.addMember(
      invitation.business_id,
      user.id,
      invitation.role,
      invitation.invited_by,
    );

    // Update invitation status
    invitation.status = InvitationStatus.ACCEPTED;
    invitation.accepted_at = new Date();
    await this.invitationRepository.save(invitation);

    return {
      message: 'Account created successfully. You can now login.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  /**
   * Accept an invitation (for existing users)
   */
  async acceptInvitation(
    token: string,
    userId: string,
  ): Promise<BusinessInvitation> {
    const invitation = await this.getInvitationByToken(token);

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is no longer valid');
    }

    // Verify user email matches invitation
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException(
        'This invitation was sent to a different email address',
      );
    }

    // Add user to business
    await this.businessMembersService.addMember(
      invitation.business_id,
      userId,
      invitation.role,
      invitation.invited_by,
    );

    // Update invitation status
    invitation.status = InvitationStatus.ACCEPTED;
    invitation.accepted_at = new Date();

    return this.invitationRepository.save(invitation);
  }

  /**
   * Reject an invitation
   */
  async rejectInvitation(
    token: string,
    userId: string,
  ): Promise<BusinessInvitation> {
    const invitation = await this.getInvitationByToken(token);

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is no longer valid');
    }

    // Verify user email matches invitation
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException(
        'This invitation was sent to a different email address',
      );
    }

    // Update invitation status
    invitation.status = InvitationStatus.REJECTED;
    invitation.rejected_at = new Date();

    return this.invitationRepository.save(invitation);
  }

  /**
   * Get all invitations for a business
   */
  async getBusinessInvitations(
    businessId: string,
  ): Promise<BusinessInvitation[]> {
    return this.invitationRepository.find({
      where: { business_id: businessId },
      relations: ['inviter'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Cancel/delete an invitation
   */
  async cancelInvitation(invitationId: string): Promise<void> {
    const result = await this.invitationRepository.delete(invitationId);

    if (result.affected === 0) {
      throw new NotFoundException('Invitation not found');
    }
  }

  /**
   * Clean up expired invitations (can be run as a cron job)
   */
  async cleanupExpiredInvitations(): Promise<number> {
    const result = await this.invitationRepository.update(
      {
        status: InvitationStatus.PENDING,
        expires_at: LessThan(new Date()),
      },
      {
        status: InvitationStatus.EXPIRED,
      },
    );

    return result.affected || 0;
  }

  /**
   * Send invitation email
   */
  private async sendInvitationEmail(
    invitation: BusinessInvitation,
    business: Business,
  ): Promise<void> {
    const invitationUrl = `${this.configService.get('FRONTEND_URL')}/invitations/${invitation.token}`;

    const roleLabels = {
      [Role.BUSINESS_ADMIN]: 'Administrateur',
      [Role.TEAM_MEMBER]: 'Membre de l\'équipe',
      [Role.ACCOUNTANT]: 'Comptable',
    };

    const roleLabel = roleLabels[invitation.role] || invitation.role;

    const mailOptions = {
      from: this.configService.get('SMTP_FROM'),
      to: invitation.email,
      subject: `Invitation à rejoindre ${business.name}`,
      html: this.getInvitationEmailTemplate(
        business.name,
        roleLabel,
        invitationUrl,
        invitation.expires_at,
      ),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      // Don't throw error - invitation is still created
    }
  }

  /**
   * Email template for invitation
   */
  private getInvitationEmailTemplate(
    businessName: string,
    role: string,
    invitationUrl: string,
    expiresAt: Date,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #4F46E5;
            margin-bottom: 10px;
          }
          h1 {
            color: #1F2937;
            font-size: 24px;
            margin-bottom: 20px;
          }
          .business-name {
            color: #4F46E5;
            font-weight: 600;
          }
          .role-badge {
            display: inline-block;
            background: #EEF2FF;
            color: #4F46E5;
            padding: 6px 12px;
            border-radius: 6px;
            font-weight: 500;
            margin: 10px 0;
          }
          .button {
            display: inline-block;
            background: #4F46E5;
            color: #ffffff;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
          }
          .button:hover {
            background: #4338CA;
          }
          .info {
            background: #F9FAFB;
            border-left: 4px solid #4F46E5;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #E5E7EB;
            color: #6B7280;
            font-size: 14px;
          }
          .expiry {
            color: #DC2626;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🏢 NovaEntra</div>
          </div>
          
          <h1>Vous avez été invité à rejoindre une entreprise</h1>
          
          <p>Bonjour,</p>
          
          <p>
            Vous avez été invité à rejoindre <span class="business-name">${businessName}</span> 
            en tant que <span class="role-badge">${role}</span>.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationUrl}" class="button">
              Accepter l'invitation
            </a>
          </div>
          
          <div class="info">
            <strong>⏰ Cette invitation expire le:</strong><br>
            <span class="expiry">${expiresAt.toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}</span>
          </div>
          
          <p>
            Si vous n'avez pas de compte, vous devrez en créer un avec cette adresse email 
            avant d'accepter l'invitation.
          </p>
          
          <p>
            Si vous ne souhaitez pas rejoindre cette entreprise, vous pouvez ignorer cet email 
            ou refuser l'invitation en cliquant sur le lien ci-dessus.
          </p>
          
          <div class="footer">
            <p>
              Cet email a été envoyé par BizManage.<br>
              Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email en toute sécurité.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

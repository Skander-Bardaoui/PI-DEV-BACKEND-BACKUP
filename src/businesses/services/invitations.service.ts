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

  async sendInvitation(
    businessId: string,
    email: string,
    role: Role,
    invitedBy: string,
  ): Promise<BusinessInvitation> {
    if (![Role.BUSINESS_ADMIN, Role.TEAM_MEMBER, Role.ACCOUNTANT].includes(role)) {
      throw new BadRequestException(
        'Invalid role. Can only invite BUSINESS_ADMIN, TEAM_MEMBER, or ACCOUNTANT',
      );
    }

    const business = await this.businessRepository.findOne({
      where: { id: businessId },
      relations: ['tenant'],
    });
    if (!business) throw new NotFoundException('Business not found');

    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      const hasAccess = await this.businessMembersService.hasAccess(existingUser.id, businessId);
      if (hasAccess) throw new BadRequestException('User is already a member of this business');
    }

    const pendingInvitation = await this.invitationRepository.findOne({
      where: { business_id: businessId, email, status: InvitationStatus.PENDING },
    });
    if (pendingInvitation) {
      throw new BadRequestException('An invitation has already been sent to this email');
    }

    const token = crypto.randomBytes(32).toString('hex');
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
    await this.sendInvitationEmail(saved, business);
    return saved;
  }

  async getInvitationByToken(token: string): Promise<BusinessInvitation> {
    const invitation = await this.invitationRepository.findOne({
      where: { token },
      relations: ['business', 'inviter'],
    });
    if (!invitation) throw new NotFoundException('Invitation not found');

    if (new Date() > invitation.expires_at) {
      if (invitation.status === InvitationStatus.PENDING) {
        invitation.status = InvitationStatus.EXPIRED;
        await this.invitationRepository.save(invitation);
      }
      throw new BadRequestException('Invitation has expired');
    }

    return invitation;
  }

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

    const existingUser = await this.userRepository.findOne({
      where: { email: invitation.email },
    });
    if (existingUser) {
      throw new BadRequestException(
        'An account with this email already exists. Please login instead.',
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = this.userRepository.create({
      email: invitation.email,
      firstName,
      lastName,
      phone,
      password_hash: hashedPassword,
      role: invitation.role,
      is_verified: true,
      is_suspended: false,
    });
    await this.userRepository.save(user);

    await this.businessMembersService.addMember(
      invitation.business_id,
      user.id,
      invitation.role,
      invitation.invited_by,
    );

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

  async acceptInvitation(token: string, userId: string): Promise<BusinessInvitation> {
    const invitation = await this.getInvitationByToken(token);
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is no longer valid');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException('This invitation was sent to a different email address');
    }

    await this.businessMembersService.addMember(
      invitation.business_id,
      userId,
      invitation.role,
      invitation.invited_by,
    );

    invitation.status = InvitationStatus.ACCEPTED;
    invitation.accepted_at = new Date();
    return this.invitationRepository.save(invitation);
  }

  async rejectInvitation(token: string, userId: string): Promise<BusinessInvitation> {
    const invitation = await this.getInvitationByToken(token);
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is no longer valid');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException('This invitation was sent to a different email address');
    }

    invitation.status = InvitationStatus.REJECTED;
    invitation.rejected_at = new Date();
    return this.invitationRepository.save(invitation);
  }

  async getBusinessInvitations(businessId: string): Promise<BusinessInvitation[]> {
    return this.invitationRepository.find({
      where: { business_id: businessId },
      relations: ['inviter'],
      order: { created_at: 'DESC' },
    });
  }

  async cancelInvitation(invitationId: string): Promise<void> {
    const result = await this.invitationRepository.delete(invitationId);
    if (result.affected === 0) throw new NotFoundException('Invitation not found');
  }

  async cleanupExpiredInvitations(): Promise<number> {
    const result = await this.invitationRepository.update(
      { status: InvitationStatus.PENDING, expires_at: LessThan(new Date()) },
      { status: InvitationStatus.EXPIRED },
    );
    return result.affected || 0;
  }

  // ─── Send email ──────────────────────────────────────────────────────────────

  private async sendInvitationEmail(
    invitation: BusinessInvitation,
    business: Business,
  ): Promise<void> {
    const invitationUrl = `${this.configService.get('FRONTEND_URL')}/invitations/${invitation.token}`;

    const roleLabels: Record<string, string> = {
      [Role.BUSINESS_ADMIN]: 'Administrateur',
      [Role.TEAM_MEMBER]:    "Membre de l'équipe",
      [Role.ACCOUNTANT]:     'Comptable',
    };

    const roleLabel = roleLabels[invitation.role] || invitation.role;

    await this.transporter.sendMail({
      from: `"NovEntra" <${this.configService.get('SMTP_FROM')}>`,
      to: invitation.email,
      subject: `Invitation à rejoindre ${business.name} sur NovEntra`,
      html: this.buildEmailHtml({
        businessName:   business.name,
        role:           roleLabel,
        invitationUrl,
        expiresAt:      invitation.expires_at,
        recipientEmail: invitation.email,
      }),
    }).catch(err => console.error('Failed to send invitation email:', err));
  }

  // ─── Email HTML builder ──────────────────────────────────────────────────────

  private buildEmailHtml(opts: {
    businessName:   string;
    role:           string;
    invitationUrl:  string;
    expiresAt:      Date;
    recipientEmail: string;
  }): string {
    const { businessName, role, invitationUrl, expiresAt, recipientEmail } = opts;

    const expiryStr = expiresAt.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day:     'numeric',
      month:   'long',
      year:    'numeric',
    });

    const year = new Date().getFullYear();

    const roleColorMap: Record<string, { bg: string; text: string; border: string }> = {
      'Administrateur':     { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
      "Membre de l'équipe": { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
      'Comptable':          { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
    };
    const roleStyle = roleColorMap[role] ?? { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' };

    return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Invitation NovEntra</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;-webkit-font-smoothing:antialiased;">

<!-- ═══════════════════════════════════════════════════════════════════════════
     WRAPPER
════════════════════════════════════════════════════════════════════════════ -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F1F5F9">
  <tr>
    <td align="center" style="padding:48px 16px;">

      <!-- ── CARD ──────────────────────────────────────────────────────────── -->
      <table width="560" cellpadding="0" cellspacing="0" border="0"
             style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;
                    overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- ██ HERO HEADER ██ -->
        <tr>
          <td align="center"
              style="background:linear-gradient(135deg,#4F46E5 0%,#6D28D9 100%);
                     padding:48px 40px 40px;">

            <!-- Logo pill -->
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center"
                    style="background:rgba(255,255,255,0.18);border-radius:50px;
                           padding:8px 22px;margin-bottom:28px;">
                  <span style="font-size:20px;font-weight:800;color:#ffffff;
                               letter-spacing:-0.3px;font-family:Arial,sans-serif;">
                    &#127970;&nbsp; NovEntra
                  </span>
                </td>
              </tr>
            </table>

            <!-- Spacer -->
            <div style="height:24px;"></div>

            <!-- Avatar circle -->
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center"
                    style="width:80px;height:80px;background:rgba(255,255,255,0.25);
                           border-radius:50%;font-size:36px;line-height:80px;
                           text-align:center;">
                  &#9993;
                </td>
              </tr>
            </table>

            <div style="height:20px;"></div>

            <!-- Headline -->
            <p style="margin:0;font-size:26px;font-weight:700;color:#ffffff;
                      font-family:Arial,sans-serif;line-height:1.3;">
              Vous &ecirc;tes invit&eacute;&nbsp;!
            </p>
            <p style="margin:10px 0 0;font-size:15px;color:rgba(255,255,255,0.80);
                      font-family:Arial,sans-serif;">
              Rejoignez l&rsquo;&eacute;quipe de
              <strong style="color:#ffffff;">${businessName}</strong>
            </p>
          </td>
        </tr>

        <!-- ██ BODY ██ -->
        <tr>
          <td style="padding:40px 40px 32px;">

            <!-- Greeting -->
            <p style="margin:0 0 6px;font-size:14px;color:#94A3B8;
                      font-family:Arial,sans-serif;">Bonjour,</p>
            <p style="margin:0 0 28px;font-size:15px;color:#475569;
                      font-family:Arial,sans-serif;line-height:1.6;">
              Vous avez re&ccedil;u une invitation &agrave; rejoindre
              <strong style="color:#4F46E5;">${businessName}</strong>
              sur la plateforme&nbsp;NovEntra.
            </p>

            <!-- ── Info card ── -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:#F8FAFC;border:1px solid #E2E8F0;
                          border-radius:14px;margin-bottom:32px;">
              <tr>
                <td style="padding:24px 28px;">

                  <!-- Business row -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="46" valign="middle">
                        <table cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td align="center" valign="middle"
                                style="width:46px;height:46px;
                                       background:linear-gradient(135deg,#4F46E5,#6D28D9);
                                       border-radius:12px;font-size:22px;line-height:46px;">
                              &#127970;
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="padding-left:16px;" valign="middle">
                        <p style="margin:0 0 2px;font-size:11px;font-weight:600;
                                  color:#94A3B8;text-transform:uppercase;
                                  letter-spacing:0.8px;font-family:Arial,sans-serif;">
                          Entreprise
                        </p>
                        <p style="margin:0;font-size:17px;font-weight:700;
                                  color:#0F172A;font-family:Arial,sans-serif;">
                          ${businessName}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Divider -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding:18px 0;">
                        <div style="height:1px;background:#E2E8F0;"></div>
                      </td>
                    </tr>
                  </table>

                  <!-- Role row -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="46" valign="middle">
                        <table cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td align="center" valign="middle"
                                style="width:46px;height:46px;
                                       background:${roleStyle.bg};
                                       border-radius:12px;font-size:22px;line-height:46px;">
                              &#127991;
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="padding-left:16px;" valign="middle">
                        <p style="margin:0 0 6px;font-size:11px;font-weight:600;
                                  color:#94A3B8;text-transform:uppercase;
                                  letter-spacing:0.8px;font-family:Arial,sans-serif;">
                          Votre r&ocirc;le
                        </p>
                        <span style="display:inline-block;
                                     background:${roleStyle.bg};
                                     color:${roleStyle.text};
                                     border:1px solid ${roleStyle.border};
                                     font-size:13px;font-weight:700;
                                     padding:5px 14px;border-radius:50px;
                                     font-family:Arial,sans-serif;">
                          ${role}
                        </span>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>
            </table>

            <!-- ── CTA Button ── -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="margin-bottom:32px;">
              <tr>
                <td align="center">
                  <a href="${invitationUrl}"
                     style="display:inline-block;
                            background:linear-gradient(135deg,#4F46E5 0%,#6D28D9 100%);
                            color:#ffffff;text-decoration:none;
                            font-size:16px;font-weight:700;
                            padding:17px 52px;border-radius:14px;
                            font-family:Arial,sans-serif;
                            letter-spacing:0.2px;">
                    &#10003;&nbsp;&nbsp;Accepter l&rsquo;invitation
                  </a>
                </td>
              </tr>
            </table>

            <!-- ── Expiry warning ── -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="margin-bottom:28px;">
              <tr>
                <td style="background:#FFFBEB;border:1px solid #FCD34D;
                           border-radius:12px;padding:18px 22px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="28" valign="top" style="padding-top:2px;font-size:18px;">
                        &#8987;
                      </td>
                      <td style="padding-left:12px;">
                        <p style="margin:0 0 4px;font-size:12px;font-weight:700;
                                  color:#92400E;text-transform:uppercase;
                                  letter-spacing:0.6px;font-family:Arial,sans-serif;">
                          Invitation limit&eacute;e dans le temps
                        </p>
                        <p style="margin:0;font-size:14px;color:#78350F;
                                  font-family:Arial,sans-serif;line-height:1.5;">
                          Cette invitation expire le
                          <strong>${expiryStr}</strong>.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- ── Steps ── -->
            <p style="margin:0 0 16px;font-size:14px;font-weight:700;
                      color:#0F172A;font-family:Arial,sans-serif;">
              Comment &ccedil;a marche ?
            </p>

            <!-- Step 1 -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="margin-bottom:12px;">
              <tr>
                <td width="36" valign="top">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" valign="middle"
                          style="width:32px;height:32px;background:#4F46E5;
                                 border-radius:50%;font-size:13px;font-weight:700;
                                 color:#ffffff;line-height:32px;font-family:Arial,sans-serif;">
                        1
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="padding-left:14px;" valign="top">
                  <p style="margin:0 0 2px;font-size:14px;font-weight:600;
                            color:#0F172A;font-family:Arial,sans-serif;">
                    Cliquez sur le bouton
                  </p>
                  <p style="margin:0;font-size:13px;color:#64748B;
                            font-family:Arial,sans-serif;">
                    Cliquez sur &ldquo;Accepter l&rsquo;invitation&rdquo; ci-dessus
                  </p>
                </td>
              </tr>
            </table>

            <!-- Step 2 -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="margin-bottom:12px;">
              <tr>
                <td width="36" valign="top">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" valign="middle"
                          style="width:32px;height:32px;background:#6D28D9;
                                 border-radius:50%;font-size:13px;font-weight:700;
                                 color:#ffffff;line-height:32px;font-family:Arial,sans-serif;">
                        2
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="padding-left:14px;" valign="top">
                  <p style="margin:0 0 2px;font-size:14px;font-weight:600;
                            color:#0F172A;font-family:Arial,sans-serif;">
                    Cr&eacute;ez votre compte
                  </p>
                  <p style="margin:0;font-size:13px;color:#64748B;
                            font-family:Arial,sans-serif;">
                    Renseignez vos informations et choisissez un mot de passe
                  </p>
                </td>
              </tr>
            </table>

            <!-- Step 3 -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="margin-bottom:32px;">
              <tr>
                <td width="36" valign="top">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" valign="middle"
                          style="width:32px;height:32px;background:#059669;
                                 border-radius:50%;font-size:13px;font-weight:700;
                                 color:#ffffff;line-height:32px;font-family:Arial,sans-serif;">
                        3
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="padding-left:14px;" valign="top">
                  <p style="margin:0 0 2px;font-size:14px;font-weight:600;
                            color:#0F172A;font-family:Arial,sans-serif;">
                    Acc&eacute;dez &agrave; la plateforme
                  </p>
                  <p style="margin:0;font-size:13px;color:#64748B;
                            font-family:Arial,sans-serif;">
                    Commencez &agrave; collaborer avec votre &eacute;quipe imm&eacute;diatement
                  </p>
                </td>
              </tr>
            </table>

            <!-- ── Link fallback ── -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#F8FAFC;border:1px solid #E2E8F0;
                           border-radius:10px;padding:16px 20px;">
                  <p style="margin:0 0 6px;font-size:12px;color:#94A3B8;
                            font-family:Arial,sans-serif;">
                    Si le bouton ne fonctionne pas, copiez ce lien :
                  </p>
                  <a href="${invitationUrl}"
                     style="font-size:12px;color:#4F46E5;word-break:break-all;
                            font-family:Arial,sans-serif;">
                    ${invitationUrl}
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ██ FOOTER ██ -->
        <tr>
          <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;
                     padding:24px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;color:#64748B;
                      font-family:Arial,sans-serif;">
              Cet email a &eacute;t&eacute; envoy&eacute; &agrave;
              <strong style="color:#475569;">${recipientEmail}</strong>
            </p>
            <p style="margin:0 0 12px;font-size:12px;color:#94A3B8;
                      font-family:Arial,sans-serif;">
              Si vous n&rsquo;attendiez pas cette invitation, ignorez cet email.
            </p>
            <p style="margin:0;font-size:12px;color:#CBD5E1;
                      font-family:Arial,sans-serif;">
              &copy; ${year} NovEntra &mdash; Tous droits r&eacute;serv&eacute;s
            </p>
          </td>
        </tr>

      </table>
      <!-- ── END CARD ── -->

    </td>
  </tr>
</table>

</body>
</html>`;
  }
}
// src/Purchases/services/supplier-portal.service.ts
import {
  Injectable, NotFoundException,
  BadRequestException, UnauthorizedException, Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { JwtService }       from '@nestjs/jwt';
import { ConfigService }    from '@nestjs/config';
import { SupplierPortalToken } from '../entities/supplier-portal-token.entity';
import { SupplierPO }          from '../entities/supplier-po.entity';
import { PurchaseInvoice }     from '../entities/purchase-invoice.entity';
import { Supplier }            from '../entities/supplier.entity';
import { POStatus }            from '../enum/po-status.enum';
import { InvoiceStatus }       from '../enum/invoice-status.enum';
import { PurchaseMailService } from './purchase-mail.service';
import { SupplierPayment } from '../../payments/entities/supplier-payment.entity';
import { DisputeResponse, DisputeResponseStatus } from '../entities/dispute-response.entity';

@Injectable()
export class SupplierPortalService {

  private readonly logger = new Logger(SupplierPortalService.name);

constructor(
  // @InjectRepository(SupplierPortalToken)
  // private readonly tokenRepo: Repository<SupplierPortalToken>,

  @InjectRepository(SupplierPO)
  private readonly poRepo: Repository<SupplierPO>,

  @InjectRepository(PurchaseInvoice)
  private readonly invoiceRepo: Repository<PurchaseInvoice>,

  @InjectRepository(SupplierPayment)
  private readonly paymentRepo: Repository<SupplierPayment>,

  @InjectRepository(Supplier)
  private readonly supplierRepo: Repository<Supplier>,

  @InjectRepository(DisputeResponse)
  private readonly disputeResponseRepo: Repository<DisputeResponse>,

  private readonly jwtService: JwtService,
  private readonly config: ConfigService,

  @Inject(forwardRef(() => PurchaseMailService))
  private readonly mailService: PurchaseMailService,
) {}    

  // ─── Générer un token de portail pour un BC ──────────────────────────────
  async generatePortalToken(
    businessId: string,
    supplierId: string,
    supplierPoId?: string,
  ): Promise<string> {
    const expiresIn = 72;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresIn);

    const payload = {
      business_id:    businessId,
      supplier_id:    supplierId,
      supplier_po_id: supplierPoId ?? null,
      type:           'supplier_portal',
    };

    const token = this.jwtService.sign(payload, {
      secret:    this.config.get('JWT_PORTAL_SECRET', 'portal_secret_key_change_me'),
      expiresIn: `${expiresIn}h`,
    });

    // Temporairement désactivé - table supplier_portal_tokens a des problèmes
    // const entity = this.tokenRepo.create({
    //   token,
    //   business_id:    businessId,
    //   supplier_id:    supplierId,
    //   expires_at:     expiresAt,
    //   used:           false,
    // });
    // await this.tokenRepo.save(entity);

    return token;
  }

  // ─── Valider un token ────────────────────────────────────────────────────
  async validateToken(token: string): Promise<{
    business_id:    string;
    supplier_id:    string;
    supplier_po_id: string | null;
  }> {
    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: this.config.get('JWT_PORTAL_SECRET', 'portal_secret_key_change_me'),
      });
    } catch {
      throw new UnauthorizedException('Lien expiré ou invalide.');
    }

    if (payload.type !== 'supplier_portal') {
      throw new UnauthorizedException('Token invalide.');
    }

    // Temporairement désactivé - table supplier_portal_tokens a des problèmes
    // const entity = await this.tokenRepo.findOne({ where: { token } });
    // if (!entity) throw new UnauthorizedException('Lien introuvable.');
    // if (entity.used) throw new UnauthorizedException('Ce lien a déjà été utilisé.');
    // if (new Date() > entity.expires_at) throw new UnauthorizedException('Ce lien a expiré.');

    return {
      business_id:    payload.business_id,
      supplier_id:    payload.supplier_id,
      supplier_po_id: payload.supplier_po_id,
    };
  }

  // ─── Données complètes du portail ────────────────────────────────────────
  async getPortalData(token: string) {
    const { business_id, supplier_id, supplier_po_id } = await this.validateToken(token);

    const supplier = await this.supplierRepo.findOne({
      where: { id: supplier_id, business_id },
    });
    if (!supplier) throw new NotFoundException('Fournisseur introuvable.');

    let currentPO: SupplierPO | null = null;
    if (supplier_po_id) {
      currentPO = await this.poRepo.findOne({
        where:     { id: supplier_po_id, business_id },
        relations: ['items'],
      });
    }

    const pos = await this.poRepo.find({
      where: { supplier_id, business_id },
      order: { created_at: 'DESC' },
      take:  20,
    });

    const invoices = await this.invoiceRepo.find({
      where: { supplier_id, business_id },
      order: { invoice_date: 'DESC' },
      take:  20,
    });

    const payments = await this.paymentRepo.find({
      where: { supplier_id, business_id },
      order: { payment_date: 'DESC' },
      take:  20,
    });

    const totalFacturé = invoices.reduce((s, i) => s + Number(i.net_amount), 0);
    const totalPayé    = payments.reduce((s, p) => s + Number(p.amount),     0);
    const totalDû      = Math.max(0, totalFacturé - totalPayé);

    return {
      supplier,
      current_po: currentPO,
      pos,
      invoices,
      payments,
      stats: {
        total_facture: Math.round(totalFacturé * 1000) / 1000,
        total_paye:    Math.round(totalPayé    * 1000) / 1000,
        total_du:      Math.round(totalDû      * 1000) / 1000,
        nb_pos:        pos.length,
        nb_invoices:   invoices.length,
      },
    };
  }

  // ─── Confirmer un BC ─────────────────────────────────────────────────────
async confirmPO(token: string, poId: string): Promise<SupplierPO> {
  const { business_id, supplier_id } = await this.validateToken(token);
 
  const po = await this.poRepo.findOne({
    where: { id: poId, business_id, supplier_id },
    relations: ['supplier', 'items'],
  });
  if (!po) throw new NotFoundException('BC introuvable.');
  if (po.status !== POStatus.SENT) {
    throw new BadRequestException(
      `BC en statut "${po.status}" — seul un BC SENT peut être confirmé.`,
    );
  }
 
  po.status = POStatus.CONFIRMED;
  await this.poRepo.save(po);
  this.logger.log(`BC ${po.po_number} confirmé par le fournisseur via portail.`);
 
  // ← NOUVEAU : notifier le business_owner par email
  this.mailService.sendPOConfirmedToOwner(po).catch(err =>
    this.logger.error(`Email confirmation BC échoué : ${err.message}`),
  );
 
  return po;
}

  // ─── Refuser un BC ───────────────────────────────────────────────────────
async refusePO(token: string, poId: string, reason: string): Promise<SupplierPO> {
  const { business_id, supplier_id } = await this.validateToken(token);
 
  const po = await this.poRepo.findOne({
    where: { id: poId, business_id, supplier_id },
    relations: ['supplier', 'items'],
  });
  if (!po) throw new NotFoundException('BC introuvable.');
  if (po.status !== POStatus.SENT) {
    throw new BadRequestException(
      `BC en statut "${po.status}" — seul un BC SENT peut être refusé.`,
    );
  }
 
  po.status = POStatus.CANCELLED;
  await this.poRepo.save(po);
  this.logger.log(`BC ${po.po_number} refusé par le fournisseur. Motif : ${reason}`);
 
  // ← NOUVEAU : notifier le business_owner par email
  this.mailService.sendPORefusedToOwner(po, reason).catch(err =>
    this.logger.error(`Email refus BC échoué : ${err.message}`),
  );
 
  return po;
}

  // ─── Répondre à un litige ────────────────────────────────────────────────
  async respondToDispute(
    token: string,
    invoiceId: string,
    responseMessage: string,
    proposedSolution?: string,
    proposedAmount?: number,
  ): Promise<DisputeResponse> {
    const { business_id, supplier_id } = await this.validateToken(token);

    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, business_id, supplier_id },
      relations: ['supplier'],
    });

    if (!invoice) {
      throw new NotFoundException('Facture introuvable.');
    }

    if (invoice.status !== InvoiceStatus.DISPUTED) {
      throw new BadRequestException('Cette facture n\'est pas en litige.');
    }

    // Créer la réponse
    const response = this.disputeResponseRepo.create({
      invoice_id: invoiceId,
      supplier_id,
      business_id,
      response_message: responseMessage,
      proposed_solution: proposedSolution,
      proposed_amount: proposedAmount,
      status: DisputeResponseStatus.PENDING,
    });

    await this.disputeResponseRepo.save(response);

    this.logger.log(
      `Réponse au litige reçue du fournisseur ${supplier_id} pour facture ${invoice.invoice_number_supplier}`
    );

    // Envoyer un email au business owner
    await this.mailService.sendDisputeResponseToOwner(
      business_id,
      invoice,
      responseMessage,
      proposedSolution,
      proposedAmount,
    );

    return response;
  }

  // ─── Obtenir les litiges pour un fournisseur ─────────────────────────────
  async getDisputedInvoices(token: string) {
    const { business_id, supplier_id } = await this.validateToken(token);

    const invoices = await this.invoiceRepo.find({
      where: {
        business_id,
        supplier_id,
        status: InvoiceStatus.DISPUTED,
      },
      relations: ['supplier_po'],
      order: { invoice_date: 'DESC' },
    });

    // Récupérer les réponses existantes
    const responses = await this.disputeResponseRepo.find({
      where: {
        business_id,
        supplier_id,
      },
      order: { created_at: 'DESC' },
    });

    return {
      disputed_invoices: invoices,
      responses,
    };
  }
}
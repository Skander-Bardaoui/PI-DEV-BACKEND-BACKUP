// src/sales/services/sales-matching.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import { SalesOrder } from '../entities/sales-order.entity';
import { DeliveryNote } from '../entities/delivery-note.entity';
import { Quote } from '../entities/quote.entity';

interface LineDiscrepancy {
  description: string;
  order_quantity: number;
  delivered_quantity: number;
  order_unit_price: number;
  order_line_total: number;
  delivered_total: number;
  discrepancy_amount: number;
  status: 'OK' | 'PRICE_MISMATCH' | 'QTY_MISMATCH' | 'NOT_DELIVERED' | 'OVER_INVOICED';
}

export interface SalesMatchResult {
  invoice_id: string;
  invoice_number: string;
  client_name: string;
  status: string;
  can_auto_validate: boolean;
  should_alert: boolean;
  quote_total: number | null;
  order_total: number;
  delivered_total: number;
  invoiced_total: number;
  total_discrepancy: number;
  discrepancy_pct: number;
  line_discrepancies: LineDiscrepancy[];
  issues: string[];
  recommendations: string[];
  quote_number: string | null;
  order_number: string | null;
  delivery_note_numbers: string[];
  matching_date: string;
}

@Injectable()
export class SalesMatchingService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
    @InjectRepository(SalesOrder)
    private salesOrderRepo: Repository<SalesOrder>,
    @InjectRepository(DeliveryNote)
    private deliveryNoteRepo: Repository<DeliveryNote>,
    @InjectRepository(Quote)
    private quoteRepo: Repository<Quote>,
  ) {}

  async matchInvoice(businessId: string, invoiceId: string): Promise<SalesMatchResult> {
    // Fetch invoice with relations
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, business_id: businessId },
      relations: ['client', 'items', 'sales_order', 'sales_order.items', 'sales_order.quote'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Initialize result
    const result: SalesMatchResult = {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      client_name: invoice.client?.name || 'N/A',
      status: 'MATCHED',
      can_auto_validate: false,
      should_alert: false,
      quote_total: null,
      order_total: 0,
      delivered_total: 0,
      invoiced_total: Number(invoice.net_amount) || 0, // Use Net TTC (total with taxes)
      total_discrepancy: 0,
      discrepancy_pct: 0,
      line_discrepancies: [],
      issues: [],
      recommendations: [],
      quote_number: null,
      order_number: null,
      delivery_note_numbers: [],
      matching_date: new Date().toISOString(),
    };

    // Check if invoice is linked to a sales order
    if (!invoice.sales_order) {
      result.status = 'MISSING_ORDER';
      result.issues.push('Cette facture n\'est pas liée à une commande client');
      result.recommendations.push('Créez la facture depuis une commande client pour activer le rapprochement automatique');
      return result;
    }

    const salesOrder = invoice.sales_order;
    result.order_number = salesOrder.orderNumber;
    result.order_total = Number(salesOrder.netAmount) || 0; // Use Net TTC (total with taxes)

    // Check for quote
    if (salesOrder.quote) {
      result.quote_number = salesOrder.quote.quoteNumber;
      result.quote_total = Number(salesOrder.quote.netAmount) || 0; // Use Net TTC (total with taxes)
    }

    // Fetch delivery notes for this sales order
    const deliveryNotes = await this.deliveryNoteRepo.find({
      where: { salesOrderId: salesOrder.id, businessId },
      relations: ['items'],
    });

    result.delivery_note_numbers = deliveryNotes.map(dn => dn.deliveryNoteNumber);

    // Calculate delivered total with taxes
    let deliveredTotal = 0;
    const deliveredQuantities = new Map<string, number>();

    for (const dn of deliveryNotes) {
      for (const item of dn.items || []) {
        const key = item.description?.trim().toLowerCase() || '';
        const qty = Number(item.deliveredQuantity) || 0;
        deliveredQuantities.set(key, (deliveredQuantities.get(key) || 0) + qty);

        // Find matching order item to get price and tax rate
        const orderItem = salesOrder.items?.find(
          oi => oi.description?.trim().toLowerCase() === key
        );
        if (orderItem) {
          const priceHT = qty * Number(orderItem.unitPrice);
          const taxRate = Number(orderItem.taxRate) || 0;
          const taxAmount = priceHT * (taxRate / 100);
          deliveredTotal += priceHT + taxAmount; // Add HT + Tax
        }
      }
    }

    // Add timbre fiscal to delivered total (1.000 TND)
    if (deliveredTotal > 0) {
      deliveredTotal += 1.000;
    }

    result.delivered_total = deliveredTotal;

    // Check if there are delivery notes
    if (deliveryNotes.length === 0) {
      result.status = 'MISSING_DELIVERY';
      result.issues.push('Aucun bon de livraison trouvé pour cette commande');
      result.recommendations.push('Créez un bon de livraison avant de facturer pour un meilleur suivi');
    }

    // Compare line by line (with taxes)
    const lineDiscrepancies: LineDiscrepancy[] = [];

    for (const orderItem of salesOrder.items || []) {
      const description = orderItem.description?.trim().toLowerCase() || '';
      const orderQty = Number(orderItem.quantity) || 0;
      const orderPrice = Number(orderItem.unitPrice) || 0;
      const taxRate = Number(orderItem.taxRate) || 0;
      
      // Calculate order line total with tax
      const orderLineHT = orderQty * orderPrice;
      const orderLineTax = orderLineHT * (taxRate / 100);
      const orderLineTotal = orderLineHT + orderLineTax;

      const deliveredQty = deliveredQuantities.get(description) || 0;
      
      // Calculate delivered line total with tax
      const deliveredLineHT = deliveredQty * orderPrice;
      const deliveredLineTax = deliveredLineHT * (taxRate / 100);
      const deliveredLineTotal = deliveredLineHT + deliveredLineTax;

      const discrepancy = deliveredLineTotal - orderLineTotal;

      let status: LineDiscrepancy['status'] = 'OK';
      if (deliveredQty === 0) {
        status = 'NOT_DELIVERED';
      } else if (deliveredQty > orderQty) {
        status = 'OVER_INVOICED';
      } else if (deliveredQty < orderQty) {
        status = 'QTY_MISMATCH';
      }

      lineDiscrepancies.push({
        description: orderItem.description,
        order_quantity: orderQty,
        delivered_quantity: deliveredQty,
        order_unit_price: orderPrice,
        order_line_total: orderLineTotal,
        delivered_total: deliveredLineTotal,
        discrepancy_amount: discrepancy,
        status,
      });
    }

    result.line_discrepancies = lineDiscrepancies;

    // Calculate total discrepancy
    result.total_discrepancy = result.invoiced_total - result.delivered_total;
    result.discrepancy_pct = result.delivered_total > 0
      ? (result.total_discrepancy / result.delivered_total) * 100
      : 0;

    // Determine overall status
    const absDiscrepancy = Math.abs(result.total_discrepancy);
    const absDiscrepancyPct = Math.abs(result.discrepancy_pct);

    if (absDiscrepancy < 0.01) {
      result.status = 'MATCHED';
      result.can_auto_validate = true;
    } else if (absDiscrepancyPct < 5) {
      result.status = 'PARTIAL_MATCH';
      result.recommendations.push('Écart mineur détecté, vérification recommandée');
    } else if (result.total_discrepancy > 0) {
      result.status = 'OVER_INVOICED';
      result.should_alert = true;
      result.issues.push(`Sur-facturation de ${absDiscrepancy.toFixed(3)} TND détectée`);
      result.recommendations.push('Vérifiez les quantités facturées par rapport aux quantités livrées');
    } else {
      result.status = 'UNDER_INVOICED';
      result.should_alert = true;
      result.issues.push(`Sous-facturation de ${absDiscrepancy.toFixed(3)} TND détectée`);
      result.recommendations.push('Vérifiez si toutes les livraisons ont été facturées');
    }

    // Check for line-level issues
    const notDelivered = lineDiscrepancies.filter(l => l.status === 'NOT_DELIVERED');
    const overInvoiced = lineDiscrepancies.filter(l => l.status === 'OVER_INVOICED');

    if (notDelivered.length > 0) {
      result.issues.push(`${notDelivered.length} article(s) facturé(s) mais non livré(s)`);
      result.should_alert = true;
    }

    if (overInvoiced.length > 0) {
      result.issues.push(`${overInvoiced.length} article(s) sur-facturé(s)`);
      result.should_alert = true;
    }

    return result;
  }

  async getDraftMatches(businessId: string): Promise<SalesMatchResult[]> {
    // Find all draft invoices linked to sales orders
    const draftInvoices = await this.invoiceRepo.find({
      where: { business_id: businessId, status: InvoiceStatus.DRAFT },
      relations: ['sales_order'],
    });

    const results: SalesMatchResult[] = [];

    for (const invoice of draftInvoices) {
      if (invoice.sales_order) {
        try {
          const result = await this.matchInvoice(businessId, invoice.id);
          results.push(result);
        } catch (error) {
          // Skip invoices that fail to match
          console.error(`Failed to match invoice ${invoice.id}:`, error);
        }
      }
    }

    return results;
  }
}

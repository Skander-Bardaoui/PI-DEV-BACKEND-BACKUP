import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quote, QuoteStatus } from '../entities/quote.entity';
import { SalesOrder, SalesOrderStatus } from '../entities/sales-order.entity';
import { DeliveryNote } from '../entities/delivery-note.entity';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';

@Injectable()
export class SalesDashboardService {
  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,

    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,

    @InjectRepository(DeliveryNote)
    private readonly deliveryNoteRepo: Repository<DeliveryNote>,

    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async getDashboardStats(businessId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    // Count pending quotes
    const pendingQuotes = await this.quoteRepo.count({
      where: { businessId, status: QuoteStatus.SENT },
    });

    // Count active orders (CONFIRMED + IN_PROGRESS)
    const activeOrders = await this.orderRepo.count({
      where: [
        { businessId, status: SalesOrderStatus.CONFIRMED },
        { businessId, status: SalesOrderStatus.IN_PROGRESS },
      ],
    });

    // Count today's deliveries
    const todayDeliveries = await this.deliveryNoteRepo
      .createQueryBuilder('dn')
      .where('dn.businessId = :businessId', { businessId })
      .andWhere('dn.status = :status', { status: 'delivered' })
      .andWhere('DATE(dn.deliveryDate) = DATE(:today)', { today })
      .getCount();

    // Count unpaid invoices
    const unpaidInvoices = await this.invoiceRepo.count({
      where: [
        { business_id: businessId, status: InvoiceStatus.SENT },
        { business_id: businessId, status: InvoiceStatus.OVERDUE },
      ],
    });

    // Calculate monthly revenue (from paid invoices)
    const monthlyRevenueResult = await this.invoiceRepo
      .createQueryBuilder('inv')
      .select('SUM(inv.total_ttc)', 'total')
      .where('inv.business_id = :businessId', { businessId })
      .andWhere('inv.status = :status', { status: InvoiceStatus.PAID })
      .andWhere('inv.date >= :startOfMonth', { startOfMonth })
      .andWhere('inv.date <= :endOfMonth', { endOfMonth })
      .getRawOne();

    const monthlyRevenue = Number(monthlyRevenueResult?.total || 0);

    // Get top 5 clients by total invoice amount
    const topClientsResult = await this.invoiceRepo
      .createQueryBuilder('inv')
      .select('c.name', 'name')
      .addSelect('SUM(inv.total_ttc)', 'total')
      .leftJoin('inv.client', 'c')
      .where('inv.business_id = :businessId', { businessId })
      .andWhere('inv.status = :status', { status: InvoiceStatus.PAID })
      .groupBy('c.id')
      .addGroupBy('c.name')
      .orderBy('SUM(inv.total_ttc)', 'DESC')
      .limit(5)
      .getRawMany();

    const topClients = topClientsResult.map(row => ({
      name: row.name || 'Client inconnu',
      total: Number(row.total || 0),
    }));

    // Get recent activity (last 10 items)
    const recentQuotes = await this.quoteRepo.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
      take: 3,
      relations: ['client'],
    });

    const recentOrders = await this.orderRepo.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
      take: 3,
      relations: ['client'],
    });

    const recentInvoices = await this.invoiceRepo.find({
      where: { business_id: businessId },
      order: { created_at: 'DESC' },
      take: 4,
      relations: ['client'],
    });

    const recentActivity = [
      ...recentQuotes.map(q => ({
        type: 'Devis',
        description: `Devis ${q.quoteNumber} pour ${q.client?.name || 'N/A'}`,
        date: q.createdAt,
      })),
      ...recentOrders.map(o => ({
        type: 'Commande',
        description: `Commande ${o.orderNumber} pour ${o.client?.name || 'N/A'}`,
        date: o.createdAt,
      })),
      ...recentInvoices.map(i => ({
        type: 'Facture',
        description: `Facture ${i.invoice_number} pour ${i.client?.name || 'N/A'}`,
        date: i.created_at,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    return {
      pendingQuotes,
      activeOrders,
      todayDeliveries,
      unpaidInvoices,
      monthlyRevenue,
      topClients,
      recentActivity,
    };
  }
}

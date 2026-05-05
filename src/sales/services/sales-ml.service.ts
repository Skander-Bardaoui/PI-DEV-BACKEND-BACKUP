import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import { Client } from '../entities/client.entity';

export interface SalesForecastResponse {
  forecast_days: number;
  predicted_sales: number;
  predicted_daily_avg: number;
  current_daily_avg: number;
  trend: string;
  confidence: number;
  best_selling_days: string[];
  seasonality_detected: boolean;
  growth_rate: number;
  recommendation: string;
}

export interface ClientChurnResponse {
  client_id: string;
  churn_risk_score: number;
  risk_level: string;
  days_since_last_purchase: number;
  average_purchase_interval: number;
  purchase_frequency_per_month: number;
  recommendation: string;
}

@Injectable()
export class SalesMLService {
  private readonly logger = new Logger(SalesMLService.name);
  private readonly mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(Client)
    private clientRepository: Repository<Client>,
  ) {}

  async getSalesForecast(businessId: string, forecastDays: number = 30): Promise<SalesForecastResponse> {
    try {
      this.logger.log(`Getting sales forecast for business ${businessId}`);

      // Get sales history from invoices
      const invoices = await this.invoiceRepository.find({
        where: { business_id: businessId, status: InvoiceStatus.PAID },
        order: { date: 'ASC' },
        take: 365, // Last year
      });

      if (invoices.length < 3) {
        throw new Error('Insufficient data: minimum 3 paid invoices required');
      }

      // Prepare data for ML service
      const salesHistory = invoices.map(inv => {
        // Convertir la date en objet Date si nécessaire
        const invoiceDate = inv.date instanceof Date ? inv.date : new Date(inv.date);
        
        return {
          date: invoiceDate.toISOString().split('T')[0],
          amount: parseFloat(inv.total_ttc.toString()),
          quantity: inv.items?.length || 1,
        };
      });

      // Call ML service
      const response = await axios.post(
        `${this.mlServiceUrl}/api/v1/sales/forecast`,
        {
          sales_history: salesHistory,
          forecast_days: forecastDays,
        },
        { timeout: 10000 }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Error getting sales forecast: ${error.message}`);
      throw error;
    }
  }

  async getClientChurnRisk(clientId: string): Promise<ClientChurnResponse> {
    try {
      this.logger.log(`Analyzing churn risk for client ${clientId}`);

      // Get client purchase history
      const invoices = await this.invoiceRepository.find({
        where: { client_id: clientId, status: InvoiceStatus.PAID },
        relations: ['items', 'items.product'],
        order: { date: 'ASC' },
      });

      if (invoices.length < 2) {
        throw new Error('Insufficient data: minimum 2 purchases required');
      }

      // Prepare data
      const clientHistory = invoices.map(inv => {
        // Convertir la date en objet Date si nécessaire
        const invoiceDate = inv.date instanceof Date ? inv.date : new Date(inv.date);
        
        return {
          date: invoiceDate.toISOString().split('T')[0],
          amount: parseFloat(inv.total_ttc.toString()),
          product_id: inv.items?.[0]?.product?.id || null,
          product_name: inv.items?.[0]?.product?.name || null,
          category: inv.items?.[0]?.product?.category?.name || null,
          price: inv.items?.[0]?.unit_price ? parseFloat(inv.items[0].unit_price.toString()) : null,
        };
      });

      // Call ML service
      const response = await axios.post(
        `${this.mlServiceUrl}/api/v1/sales/churn`,
        {
          client_id: clientId,
          client_history: clientHistory,
        },
        { timeout: 10000 }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Error analyzing churn risk: ${error.message}`);
      throw error;
    }
  }

  async getHighRiskClients(businessId: string): Promise<ClientChurnResponse[]> {
    try {
      this.logger.log(`Getting high risk clients for business ${businessId}`);

      // Get all clients for the business
      const clients = await this.clientRepository.find({
        where: { business_id: businessId },
      });

      // Get clients who have at least 2 paid invoices
      const clientsWithInvoices = await Promise.all(
        clients.map(async (client) => {
          const invoiceCount = await this.invoiceRepository.count({
            where: { client_id: client.id, status: InvoiceStatus.PAID },
          });
          return { client, invoiceCount };
        })
      );

      // Filter clients with at least 2 invoices
      const eligibleClients = clientsWithInvoices
        .filter(({ invoiceCount }) => invoiceCount >= 2)
        .map(({ client }) => client)
        .slice(0, 20); // Limit to 20 clients

      const churnAnalyses: ClientChurnResponse[] = [];

      // Analyze each eligible client
      for (const client of eligibleClients) {
        try {
          const analysis = await this.getClientChurnRisk(client.id);
          if (analysis.risk_level === 'high' || analysis.risk_level === 'medium') {
            churnAnalyses.push(analysis);
          }
        } catch (error) {
          // Skip clients with insufficient data
          this.logger.debug(`Skipping client ${client.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          continue;
        }
      }

      // Sort by risk score
      churnAnalyses.sort((a, b) => b.churn_risk_score - a.churn_risk_score);

      return churnAnalyses;
    } catch (error: any) {
      this.logger.error(`Error getting high risk clients: ${error.message}`);
      throw error;
    }
  }
}

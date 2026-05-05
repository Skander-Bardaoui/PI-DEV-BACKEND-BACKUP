import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseMailService } from './purchase-mail.service';
import { SupplierPortalService } from './supplier-portal.service';
import { Business } from '../../businesses/entities/business.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { SupplierPO } from '../entities/supplier-po.entity';
import { PurchaseInvoice } from '../entities/purchase-invoice.entity';

describe('PurchaseMailService', () => {
  let service: PurchaseMailService;
  let configService: ConfigService;
  let portalService: SupplierPortalService;
  let businessRepo: Repository<Business>;

  const mockBusinessId = 'business-123';
  const mockPO = {
    id: 'po-123',
    po_number: 'ACH-2024-0001',
    business_id: mockBusinessId,
    supplier_id: 'supplier-123',
    subtotal_ht: 1000,
    tax_amount: 190,
    timbre_fiscal: 1,
    net_amount: 1191,
    items: [
      {
        description: 'Product A',
        quantity_ordered: 10,
        unit_price_ht: 100,
        tax_rate_value: 19,
        line_total_ht: 1000,
      },
    ],
    supplier: {
      id: 'supplier-123',
      name: 'Test Supplier',
      email: 'supplier@test.com',
    },
  };

  const mockBusiness = {
    id: mockBusinessId,
    name: 'Test Business',
    email: 'business@test.com',
    phone: '+216 12 345 678',
    tax_id: '1234567A',
    tenant_id: 'tenant-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseMailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                GMAIL_USER: 'test@gmail.com',
                GMAIL_PASS: 'test-password',
                FRONTEND_URL: 'http://localhost:5173',
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: SupplierPortalService,
          useValue: {
            generatePortalToken: jest.fn().mockResolvedValue('mock-token-123'),
          },
        },
        {
          provide: getRepositoryToken(Business),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PurchaseMailService>(PurchaseMailService);
    configService = module.get<ConfigService>(ConfigService);
    portalService = module.get<SupplierPortalService>(SupplierPortalService);
    businessRepo = module.get<Repository<Business>>(getRepositoryToken(Business));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendPurchaseOrder', () => {
    it('should send purchase order email to supplier', async () => {
      jest.spyOn(businessRepo, 'findOne').mockResolvedValue(mockBusiness as any);
      jest.spyOn(portalService, 'generatePortalToken').mockResolvedValue('mock-token');

      // Mock transporter.sendMail
      const sendMailSpy = jest
        .spyOn(service['transporter'], 'sendMail')
        .mockResolvedValue({} as any);

      await service.sendPurchaseOrder(mockPO as any);

      expect(sendMailSpy).toHaveBeenCalled();
      expect(portalService.generatePortalToken).toHaveBeenCalledWith(
        mockBusinessId,
        'supplier-123',
        'po-123',
      );
    });

    it('should not send email if supplier has no email', async () => {
      const poWithoutEmail = {
        ...mockPO,
        supplier: { ...mockPO.supplier, email: null },
      };

      const sendMailSpy = jest.spyOn(service['transporter'], 'sendMail');

      await service.sendPurchaseOrder(poWithoutEmail as any);

      expect(sendMailSpy).not.toHaveBeenCalled();
    });
  });

  describe('sendPOConfirmedToOwner', () => {
    it('should send confirmation email to business owner', async () => {
      jest.spyOn(businessRepo, 'findOne').mockResolvedValue(mockBusiness as any);

      const sendMailSpy = jest
        .spyOn(service['transporter'], 'sendMail')
        .mockResolvedValue({} as any);

      await service.sendPOConfirmedToOwner(mockPO as any);

      expect(sendMailSpy).toHaveBeenCalled();
    });
  });

  describe('sendPORefusedToOwner', () => {
    it('should send refusal email to business owner', async () => {
      jest.spyOn(businessRepo, 'findOne').mockResolvedValue(mockBusiness as any);

      const sendMailSpy = jest
        .spyOn(service['transporter'], 'sendMail')
        .mockResolvedValue({} as any);

      await service.sendPORefusedToOwner(mockPO as any, 'Price too high');

      expect(sendMailSpy).toHaveBeenCalled();
    });
  });

  describe('sendInvoiceDiscrepancyEmail', () => {
    it('should send discrepancy email to supplier', async () => {
      jest.spyOn(businessRepo, 'findOne').mockResolvedValue(mockBusiness as any);

      const sendMailSpy = jest
        .spyOn(service['transporter'], 'sendMail')
        .mockResolvedValue({} as any);

      await service.sendInvoiceDiscrepancyEmail(
        mockBusinessId,
        'supplier@test.com',
        'Test Supplier',
        'INV-001',
        1500,
        1191,
        309,
        25.9,
        ['Price mismatch detected'],
      );

      expect(sendMailSpy).toHaveBeenCalled();
    });

    it('should not send email if supplier has no email', async () => {
      const sendMailSpy = jest.spyOn(service['transporter'], 'sendMail');

      await service.sendInvoiceDiscrepancyEmail(
        mockBusinessId,
        '',
        'Test Supplier',
        'INV-001',
        1500,
        1191,
        309,
        25.9,
        [],
      );

      expect(sendMailSpy).not.toHaveBeenCalled();
    });
  });

  describe('sendDisputeClarificationEmail', () => {
    it('should send clarification email to supplier', async () => {
      jest.spyOn(businessRepo, 'findOne').mockResolvedValue(mockBusiness as any);

      const sendMailSpy = jest
        .spyOn(service['transporter'], 'sendMail')
        .mockResolvedValue({} as any);

      await service.sendDisputeClarificationEmail(
        mockBusinessId,
        'supplier@test.com',
        'Test Supplier',
        'INV-001',
        'Price discrepancy',
        'Please clarify the price difference',
        'PRICE_DISCREPANCY',
        1500,
        1191,
        309,
      );

      expect(sendMailSpy).toHaveBeenCalled();
    });
  });

  describe('sendDisputeResponseToOwner', () => {
    it('should send supplier response to business owner', async () => {
      const mockInvoice = {
        id: 'invoice-123',
        invoice_number_supplier: 'INV-001',
        net_amount: 1191,
        supplier: {
          name: 'Test Supplier',
        },
      };

      jest.spyOn(businessRepo, 'findOne').mockResolvedValue(mockBusiness as any);

      const sendMailSpy = jest
        .spyOn(service['transporter'], 'sendMail')
        .mockResolvedValue({} as any);

      await service.sendDisputeResponseToOwner(
        mockBusinessId,
        mockInvoice as any,
        'We applied a discount',
        'Accept the invoice as is',
        1191,
      );

      expect(sendMailSpy).toHaveBeenCalled();
    });
  });

  describe('sendCancellationEmail', () => {
    it('should send cancellation email to supplier', async () => {
      jest.spyOn(businessRepo, 'findOne').mockResolvedValue(mockBusiness as any);

      const sendMailSpy = jest
        .spyOn(service['transporter'], 'sendMail')
        .mockResolvedValue({} as any);

      await service.sendCancellationEmail(mockPO as any);

      expect(sendMailSpy).toHaveBeenCalled();
    });

    it('should not send email if supplier has no email', async () => {
      const poWithoutEmail = {
        ...mockPO,
        supplier: { ...mockPO.supplier, email: null },
      };

      const sendMailSpy = jest.spyOn(service['transporter'], 'sendMail');

      await service.sendCancellationEmail(poWithoutEmail as any);

      expect(sendMailSpy).not.toHaveBeenCalled();
    });
  });
});
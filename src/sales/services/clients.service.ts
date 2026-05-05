// src/sales/services/clients.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Client } from '../entities/client.entity';
import { CreateClientDto } from '../dto/create-client.dto';
import { UpdateClientDto } from '../dto/update-client.dto';
import { QueryClientsDto } from '../dto/query-clients.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  async create(businessId: string, createClientDto: CreateClientDto): Promise<Client> {
    // Check if client with this email already exists for this business
    if (createClientDto.email) {
      const existing = await this.clientRepo.findOne({
        where: {
          business_id: businessId,
          email: createClientDto.email,
        },
      });

      if (existing) {
        throw new BadRequestException(
          `Un client avec l'email ${createClientDto.email} existe déjà dans votre système.`
        );
      }
    }

    const client = this.clientRepo.create({
      ...createClientDto,
      business_id: businessId,
    });
    return this.clientRepo.save(client);
  }

  async findAll(businessId: string, query: QueryClientsDto) {
    const { search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = { business_id: businessId };
    if (search) {
      where.name = Like(`%${search}%`);
    }

    const [clients, total] = await this.clientRepo.findAndCount({
      where,
      skip,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      clients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(businessId: string, id: string): Promise<Client> {
    const client = await this.clientRepo.findOne({
      where: { id, business_id: businessId },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    return client;
  }

  async update(businessId: string, id: string, updateClientDto: UpdateClientDto): Promise<Client> {
    const client = await this.findOne(businessId, id);
    
    // Check if email is being changed and if it already exists
    if (updateClientDto.email && updateClientDto.email !== client.email) {
      const existing = await this.clientRepo.findOne({
        where: {
          business_id: businessId,
          email: updateClientDto.email,
        },
      });

      if (existing) {
        throw new BadRequestException(
          `Un client avec l'email ${updateClientDto.email} existe déjà dans votre système.`
        );
      }
    }

    Object.assign(client, updateClientDto);
    return this.clientRepo.save(client);
  }

  async remove(businessId: string, id: string): Promise<void> {
    const client = await this.findOne(businessId, id);
    
    try {
      await this.clientRepo.remove(client);
    } catch (error: any) {
      // Check if it's a foreign key constraint error
      if (error.code === '23503') {
        throw new BadRequestException(
          'Impossible de supprimer ce client car il est lié à des devis, commandes ou factures. Veuillez d\'abord supprimer ces documents.'
        );
      }
      throw error;
    }
  }
}

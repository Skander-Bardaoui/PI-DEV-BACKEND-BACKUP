// src/clients/clients.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Client } from './entities/client.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
  ) {}

  // ─── Create Client ───────────────────────────────────────────────────────
  async create(business_id: string, dto: CreateClientDto): Promise<Client> {
    const client = this.clientRepository.create({
      business_id,
      ...dto,
      communication_history: [], // Initialize empty communication log
    });

    return this.clientRepository.save(client);
  }

  // ─── List Clients (with pagination and search) ──────────────────────────
  async findAll(
    business_id: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
  ): Promise<{ clients: Client[]; total: number }> {
    const skip = (page - 1) * limit;

    const queryBuilder = this.clientRepository
      .createQueryBuilder('client')
      .where('client.business_id = :business_id', { business_id });

    if (search) {
      queryBuilder.andWhere(
        '(client.name ILIKE :search OR client.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [clients, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('client.created_at', 'DESC')
      .getManyAndCount();

    return { clients, total };
  }

  // ─── Get Client by ID ────────────────────────────────────────────────────
  async findById(business_id: string, id: string): Promise<Client> {
    const client = await this.clientRepository.findOne({
      where: { id, business_id },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  // ─── Update Client ───────────────────────────────────────────────────────
  async update(business_id: string, id: string, dto: UpdateClientDto): Promise<Client> {
    const client = await this.findById(business_id, id);
    await this.clientRepository.update(id, dto);
    return this.findById(business_id, id);
  }

  // ─── Delete Client ───────────────────────────────────────────────────────
  async delete(business_id: string, id: string): Promise<void> {
    const result = await this.clientRepository.delete({ id, business_id });
    if (result.affected === 0) {
      throw new NotFoundException('Client not found');
    }
  }

  // ─── Add Communication Log Entry ─────────────────────────────────────────
  async addCommunication(
    business_id: string,
    id: string,
    entry: { date: Date; type: string; notes: string },
  ): Promise<Client> {
    const client = await this.findById(business_id, id);
    const history = (client.communication_history as any[]) || [];
    history.push(entry);
    await this.clientRepository.update(id, { communication_history: history });
    return this.findById(business_id, id);
  }
}
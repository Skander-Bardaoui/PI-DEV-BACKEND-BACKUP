import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Role } from './enums/role.enum';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('UsersService', () => {
  let service: UsersService;
  let repository: Repository<User>;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findAndCount: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const userData = {
        email: 'new@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      };

      const hashedPassword = 'hashed_password';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const mockUser = {
        id: 'user-123',
        ...userData,
        password_hash: hashedPassword,
        role: Role.TEAM_MEMBER,
      };

      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.create(userData);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });
  });

  describe('changePassword', () => {
    it('should change user password', async () => {
      const mockUser = {
        id: 'user-123',
        password_hash: 'old_hashed_password',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      await service.changePassword('user-123', 'oldPassword', 'newPassword');

      expect(bcrypt.compare).toHaveBeenCalledWith('oldPassword', 'old_hashed_password');
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword', 12);
      expect(repository.update).toHaveBeenCalledWith('user-123', {
        password_hash: 'new_hashed_password',
      });
    });

    it('should throw UnauthorizedException if current password is incorrect', async () => {
      const mockUser = {
        id: 'user-123',
        password_hash: 'hashed_password',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-123', 'wrongPassword', 'newPassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('updateRole', () => {
    it('should update user role', async () => {
      const mockUser = {
        id: 'user-123',
        role: Role.TEAM_MEMBER,
      };

      const updatedUser = {
        ...mockUser,
        role: Role.BUSINESS_ADMIN,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateRole('user-123', Role.BUSINESS_ADMIN);

      expect(repository.save).toHaveBeenCalled();
      expect(result.role).toBe(Role.BUSINESS_ADMIN);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.updateRole('non-existent', Role.BUSINESS_ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('suspend', () => {
    it('should suspend a user', async () => {
      const mockUser = {
        id: 'user-123',
        is_suspended: false,
      };

      const suspendedUser = {
        ...mockUser,
        is_suspended: true,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(suspendedUser);

      const result = await service.suspend('user-123');

      expect(result.is_suspended).toBe(true);
    });
  });

  describe('activate', () => {
    it('should activate a suspended user', async () => {
      const mockUser = {
        id: 'user-123',
        is_suspended: true,
      };

      const activatedUser = {
        ...mockUser,
        is_suspended: false,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(activatedUser);

      const result = await service.activate('user-123');

      expect(result.is_suspended).toBe(false);
    });
  });
});

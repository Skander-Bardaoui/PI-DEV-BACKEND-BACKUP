import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Role } from './enums/role.enum';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    findById: jest.fn(),
    updateProfile: jest.fn(),
    uploadAvatar: jest.fn(),
    changePassword: jest.fn(),
    findAll: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    updateRole: jest.fn(),
    suspend: jest.fn(),
    activate: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      role: Role.BUSINESS_OWNER,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyProfile', () => {
    it('should return user profile without password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password_hash: 'hashed_password',
      };

      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await controller.getMyProfile(mockRequest);

      expect(service.findById).toHaveBeenCalledWith('user-123');
      expect(result).not.toHaveProperty('password_hash');
      expect(result.email).toBe('test@example.com');
    });
  });

  describe('updateMyProfile', () => {
    it('should update user profile', async () => {
      const dto = {
        firstName: 'Jane',
        lastName: 'Smith',
      };

      const mockUpdatedUser = {
        id: 'user-123',
        ...dto,
        password_hash: 'hashed_password',
      };

      mockUsersService.updateProfile.mockResolvedValue(mockUpdatedUser);

      const result = await controller.updateMyProfile(mockRequest, dto);

      expect(service.updateProfile).toHaveBeenCalledWith('user-123', dto);
      expect(result).not.toHaveProperty('password_hash');
    });
  });

  describe('changePassword', () => {
    it('should change user password', async () => {
      const dto = {
        currentPassword: 'oldPassword',
        newPassword: 'newPassword',
      };

      mockUsersService.changePassword.mockResolvedValue(undefined);

      const result = await controller.changePassword(mockRequest, dto);

      expect(service.changePassword).toHaveBeenCalledWith('user-123', 'oldPassword', 'newPassword');
      expect(result).toEqual({ message: 'Password changed successfully' });
    });
  });

  describe('findAll', () => {
    it('should return paginated users without passwords', async () => {
      const query = { page: 1, limit: 20 };
      const mockUsers = [
        { id: 'user-1', email: 'user1@example.com', password_hash: 'hash1' },
        { id: 'user-2', email: 'user2@example.com', password_hash: 'hash2' },
      ];

      mockUsersService.findAll.mockResolvedValue({
        users: mockUsers,
        total: 2,
      });

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(1, 20, undefined);
      expect(result.users).toHaveLength(2);
      expect(result.users[0]).not.toHaveProperty('password_hash');
    });
  });

  describe('changeRole', () => {
    it('should change user role', async () => {
      const dto = { role: Role.BUSINESS_ADMIN };
      const mockUser = {
        id: 'user-456',
        role: Role.BUSINESS_ADMIN,
        password_hash: 'hash',
      };

      mockUsersService.updateRole.mockResolvedValue(mockUser);

      const result = await controller.changeRole('user-456', dto);

      expect(service.updateRole).toHaveBeenCalledWith('user-456', Role.BUSINESS_ADMIN);
      expect(result).not.toHaveProperty('password_hash');
    });
  });
});

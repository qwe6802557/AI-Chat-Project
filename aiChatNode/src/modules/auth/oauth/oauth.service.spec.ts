import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { UserOauth } from '../entities/user-oauth.entity';
import { User, UserRole } from '../../user/entities/user.entity';
import { UserService } from '../../user/user.service';
import { AuthService } from '../auth.service';
import { CreditsService } from '../../credits/credits.service';
import { RedisService } from '../../../common/redis/redis.service';
import { QQOAuthProvider } from './providers/qq-oauth.provider';
import { WechatOAuthProvider } from './providers/wechat-oauth.provider';
import { MockOAuthProvider } from './providers/mock-oauth.provider';
import { DEFAULT_REGISTER_CREDITS } from '../../credits/types/credits.types';

describe('OAuthService', () => {
  let service: OAuthService;

  const mockOauthRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((dto) => dto),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
    save: jest.fn((user) => Promise.resolve({ id: 'user-1', ...user })),
    create: jest.fn((dto) => dto),
  };

  const mockUserService = {
    findByUsername: jest.fn(),
  };

  const mockAuthService = {
    generateToken: jest.fn(() => 'mock_jwt_token'),
  };

  const mockCreditsService = {
    ensureAccount: jest.fn(),
    getSnapshotForUser: jest.fn(() =>
      Promise.resolve({
        total: 2000,
        consumed: 0,
        remaining: 2000,
        reserved: 0,
      }),
    ),
  };

  const mockRedisService = {
    set: jest.fn(),
    getDel: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'OAUTH_MOCK_ENABLED') return 'true';
      if (key === 'FRONTEND_URL') return 'http://localhost:5173';
      return null;
    }),
  };

  const mockQQProvider = {
    platform: 'qq',
    isConfigured: jest.fn(() => false),
    getAuthorizeUrl: jest.fn(),
    getUserProfile: jest.fn(),
  };

  const mockWechatProvider = {
    platform: 'wechat',
    isConfigured: jest.fn(() => false),
    getAuthorizeUrl: jest.fn(() => {
      throw new BadRequestException(
        '微信开放平台网站应用需企业资质认证，小程序扫码通道正在适配中，敬请期待！',
      );
    }),
    getUserProfile: jest.fn(),
  };

  const mockMockProvider = {
    platform: 'qq',
    getAuthorizeUrl: jest.fn(
      (state: string) => `http://localhost:5173/oauth/mock-auth?platform=qq&state=${state}`,
    ),
    getUserProfile: jest.fn((code: string) =>
      Promise.resolve({
        platform: 'qq',
        openid: `mock_qq_${code}`,
        unionid: null,
        nickname: 'QQ体验用户',
        avatarUrl: 'http://avatar.png',
        rawData: {},
      }),
    ),
  };

  const mockDataSource = {
    transaction: jest.fn((cb) =>
      cb({
        getRepository: (entity: any) => {
          if (entity === User) return mockUserRepo;
          if (entity === UserOauth) return mockOauthRepo;
          return null;
        },
      }),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        { provide: getRepositoryToken(UserOauth), useValue: mockOauthRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: UserService, useValue: mockUserService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: CreditsService, useValue: mockCreditsService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: QQOAuthProvider, useValue: mockQQProvider },
        { provide: WechatOAuthProvider, useValue: mockWechatProvider },
        { provide: MockOAuthProvider, useValue: mockMockProvider },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<OAuthService>(OAuthService);
  });

  describe('getAuthorizeUrl', () => {
    it('returns mock authorize URL and sets state in Redis for QQ login in sandbox mode', async () => {
      const result = await service.getAuthorizeUrl('qq');
      expect(result.platform).toBe('qq');
      expect(result.isMock).toBe(true);
      expect(result.url).toContain('/oauth/mock-auth?platform=qq&state=');
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('oauth:state:'),
        'qq',
        { EX: 300 },
      );
    });

    it('rejects wechat authorize URL with clear explanation when not configured', async () => {
      await expect(service.getAuthorizeUrl('wechat')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('handleCallback', () => {
    it('silently registers new user and grants 2000 credits on first OAuth login', async () => {
      mockOauthRepo.findOne.mockResolvedValueOnce(null); // No existing oauth binding
      mockUserRepo.findOne.mockResolvedValueOnce(null); // Username check passes

      const result = await service.handleCallback({
        platform: 'qq',
        code: 'mock_code_1234',
        state: 'mock_state_1234',
      });

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockUserRepo.save).toHaveBeenCalled();
      expect(mockCreditsService.ensureAccount).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          initialCredits: DEFAULT_REGISTER_CREDITS,
        }),
        expect.anything(),
      );
      expect(mockOauthRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'qq',
          openid: 'mock_qq_mock_code_1234',
        }),
      );
      expect(result.token).toBe('mock_jwt_token');
      expect(result.user.credits.remaining).toBe(2000);
      expect(result.user.oauth.platform).toBe('qq');
    });

    it('logs in existing user directly without re-creating account', async () => {
      const existingUser: Partial<User> = {
        id: 'existing-user-uuid',
        username: 'qq_user_exist',
        isActive: true,
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockOauthRepo.findOne.mockResolvedValueOnce({
        id: 'oauth-1',
        platform: 'qq',
        openid: 'mock_qq_code_exist',
        user: existingUser,
      });

      const result = await service.handleCallback({
        platform: 'qq',
        code: 'code_exist',
        state: 'mock_state_1',
      });

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(result.token).toBe('mock_jwt_token');
      expect(result.user.id).toBe('existing-user-uuid');
    });
  });
});

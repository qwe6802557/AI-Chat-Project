import { UserService } from './user.service';
import { ILike } from 'typeorm';

describe('UserService - findByUsernameOrEmail', () => {
  let service: UserService;
  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserService(
      mockUserRepository as any,
      mockConfigService as any,
    );
  });

  it('searches by email with ILike when input contains @', async () => {
    const mockUser = {
      id: 'u-1',
      username: 'tester',
      email: 'tester@example.com',
    };
    mockUserRepository.findOne.mockResolvedValue(mockUser);

    const result = await service.findByUsernameOrEmail('  Tester@EXAMPLE.com  ');

    expect(mockUserRepository.findOne).toHaveBeenCalledWith({
      where: { email: ILike('tester@example.com') },
    });
    expect(result).toEqual(mockUser);
  });

  it('searches by exact username when input does not contain @', async () => {
    const mockUser = {
      id: 'u-2',
      username: 'john_doe',
      email: null,
    };
    mockUserRepository.findOne.mockResolvedValue(mockUser);

    const result = await service.findByUsernameOrEmail('  john_doe  ');

    expect(mockUserRepository.findOne).toHaveBeenCalledWith({
      where: { username: 'john_doe' },
    });
    expect(result).toEqual(mockUser);
  });
});

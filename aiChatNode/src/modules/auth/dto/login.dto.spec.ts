import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto } from './login.dto';

describe('LoginDto Validation', () => {
  const createDto = (data: Partial<LoginDto>): LoginDto => {
    return plainToInstance(LoginDto, {
      password: 'Password123',
      captcha: '1234',
      captchaId: '123e4567-e89b-12d3-a456-426614174000',
      ...data,
    });
  };

  it('accepts valid username', async () => {
    const dto = createDto({ username: 'valid_user_123' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'username')).toBeUndefined();
  });

  it('accepts valid email', async () => {
    const dto = createDto({ username: 'user.name+tag@example.com' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'username')).toBeUndefined();
  });

  it('rejects invalid username or email format', async () => {
    const dto = createDto({ username: 'invalid name with space' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'username')).toBeDefined();
  });

  it('rejects empty username', async () => {
    const dto = createDto({ username: '' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'username')).toBeDefined();
  });
});

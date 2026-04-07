import type { Request } from 'express';
import type { User } from '../user/entities/user.entity';
import type { UserCreditsSnapshot } from '../credits/types/credits.types';

export interface AuthenticatedUser {
  id: User['id'];
  username: User['username'];
  phone?: User['phone'];
  email: User['email'];
  role: User['role'];
  preferences?: User['preferences'];
  isActive: User['isActive'];
  createdAt: User['createdAt'];
  updatedAt: User['updatedAt'];
  credits?: UserCreditsSnapshot;
}

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

export const toAuthenticatedUser = (user: User): AuthenticatedUser => {
  const { password, ...userWithoutPassword } = user;
  void password;
  return {
    id: userWithoutPassword.id,
    username: userWithoutPassword.username,
    phone: userWithoutPassword.phone,
    email: userWithoutPassword.email,
    role: userWithoutPassword.role,
    preferences: userWithoutPassword.preferences,
    isActive: userWithoutPassword.isActive,
    createdAt: userWithoutPassword.createdAt,
    updatedAt: userWithoutPassword.updatedAt,
  };
};

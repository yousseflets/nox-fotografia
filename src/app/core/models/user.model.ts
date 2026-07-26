export type UserRole = 'admin' | 'client';

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
  phone?: string;
}

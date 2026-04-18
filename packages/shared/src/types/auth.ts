import type { UserRole } from './enums.js';

export interface UserPayload {
  sub: string;
  email: string;
  role: UserRole;
  teamId: string;
}

export interface RefreshTokenPayload {
  sub: string;
  tid: string; // token ID for Redis lookup
  type: 'refresh';
}

export interface LoginRequest {
  email: string;
  password: string;
  totpCode?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    role: UserRole;
    teamId: string;
    totpEnabled: boolean;
  };
  accessToken: string;
  requiresTOTP?: boolean;
}

export interface RegisterResponse {
  user: {
    id: string;
    email: string;
    role: UserRole;
    teamId: string;
  };
  accessToken: string;
}

export interface TOTPSetupResponse {
  secret: string;
  qrCodeDataUri: string;
}

export interface TOTPVerifyResponse {
  enabled: boolean;
}

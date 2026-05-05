export interface AuthUserDto {
  id: number;
  name: string;
  email: string;
  username: string;
  /** Backend: LOCAL | GOOGLE */
  provider: string;
  /** Puede iniciar sesión con Google (cuenta GOOGLE o LOCAL con Google vinculado). */
  googleConnected?: boolean;
  companyId?: number | null;
  companyName?: string | null;
  companyCurrency?: 'EUR' | 'USD' | 'JPY' | 'CNY' | null;
  companyRole?: 'company_admin' | 'employee' | 'analytics_viewer' | null;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresInMs: number;
  user: AuthUserDto;
}

export interface RegisterPayload {
  name: string;
  email: string;
  username: string;
  password: string;
}

export interface LoginPayload {
  usernameOrEmail: string;
  password: string;
}

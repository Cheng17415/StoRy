export type CompanyRole = 'company_admin' | 'employee' | 'analytics_viewer';
export type CompanyCurrency = 'EUR' | 'USD' | 'JPY' | 'CNY';

export interface CompanySummaryDto {
  id: number;
  name: string;
  currency: CompanyCurrency;
  role: CompanyRole;
}

export interface CompanyMemberDto {
  userId: number;
  name: string;
  email: string;
  username: string;
  role: CompanyRole;
  joinedAt: string;
}

export interface CompanyInvitationDto {
  id: number;
  email: string;
  role: CompanyRole;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
}

export interface CompanyPageDto {
  company: CompanySummaryDto;
  members: CompanyMemberDto[];
  invitations: CompanyInvitationDto[];
}

export interface CreateCompanyPayload {
  name: string;
  password: string;
  currency: CompanyCurrency;
}

export interface JoinCompanyPayload {
  name: string;
  password: string;
}

export interface InviteMemberPayload {
  email: string;
  role: CompanyRole;
}

export interface UpdateMemberRolePayload {
  role: CompanyRole;
}

export interface UpdateCompanyCurrencyPayload {
  currency: CompanyCurrency;
}

export interface UpdateCompanyNamePayload {
  name: string;
}

export interface UpdateCompanyPasswordPayload {
  currentPassword: string;
  newPassword: string;
}

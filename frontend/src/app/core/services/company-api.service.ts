import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CompanyPageDto,
  CompanySummaryDto,
  CreateCompanyPayload,
  InviteMemberPayload,
  JoinCompanyPayload,
  UpdateMemberRolePayload,
  UpdateCompanyCurrencyPayload,
  UpdateCompanyNamePayload,
  UpdateCompanyPasswordPayload,
  CompanyMemberDto,
} from '../models/company.models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class CompanyApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private authBearerOpts(): { headers: HttpHeaders } | Record<string, never> {
    const token = this.auth.getToken();
    if (!token) {
      return {};
    }
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) };
  }

  getCompanyPage(): Observable<CompanyPageDto> {
    return this.http.get<CompanyPageDto>('/api/company', this.authBearerOpts());
  }

  createCompany(payload: CreateCompanyPayload): Observable<CompanySummaryDto> {
    return this.http.post<CompanySummaryDto>('/api/company/create', payload, this.authBearerOpts());
  }

  joinCompany(payload: JoinCompanyPayload): Observable<CompanySummaryDto> {
    return this.http.post<CompanySummaryDto>('/api/company/join', payload, this.authBearerOpts());
  }

  leaveCompany(): Observable<void> {
    return this.http.post<void>('/api/company/leave', {}, this.authBearerOpts());
  }

  inviteMember(payload: InviteMemberPayload): Observable<void> {
    return this.http.post<void>('/api/company/invitations', payload, this.authBearerOpts());
  }

  acceptInvitation(token: string): Observable<CompanySummaryDto> {
    return this.http.post<CompanySummaryDto>(
      '/api/company/invitations/accept',
      { token },
      this.authBearerOpts(),
    );
  }

  updateMemberRole(userId: number, payload: UpdateMemberRolePayload): Observable<CompanyMemberDto> {
    return this.http.patch<CompanyMemberDto>(
      `/api/company/members/${userId}/role`,
      payload,
      this.authBearerOpts(),
    );
  }

  updateCurrency(payload: UpdateCompanyCurrencyPayload): Observable<CompanySummaryDto> {
    return this.http.put<CompanySummaryDto>('/api/company/currency', payload, this.authBearerOpts());
  }

  updateName(payload: UpdateCompanyNamePayload): Observable<CompanySummaryDto> {
    return this.http.put<CompanySummaryDto>('/api/company/name', payload, this.authBearerOpts());
  }

  updatePassword(payload: UpdateCompanyPasswordPayload): Observable<CompanySummaryDto> {
    return this.http.put<CompanySummaryDto>('/api/company/password', payload, this.authBearerOpts());
  }

  removeMember(userId: number): Observable<void> {
    return this.http.delete<void>(`/api/company/members/${userId}`, this.authBearerOpts());
  }
}

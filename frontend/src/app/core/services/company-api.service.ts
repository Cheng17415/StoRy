import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CompanyPageDto,
  CompanySummaryDto,
  CreateCompanyPayload,
  InviteMemberPayload,
  JoinCompanyPayload,
} from '../models/company.models';

@Injectable({ providedIn: 'root' })
export class CompanyApiService {
  private readonly http = inject(HttpClient);

  getCompanyPage(): Observable<CompanyPageDto> {
    return this.http.get<CompanyPageDto>('/api/company');
  }

  createCompany(payload: CreateCompanyPayload): Observable<CompanySummaryDto> {
    return this.http.post<CompanySummaryDto>('/api/company/create', payload);
  }

  joinCompany(payload: JoinCompanyPayload): Observable<CompanySummaryDto> {
    return this.http.post<CompanySummaryDto>('/api/company/join', payload);
  }

  leaveCompany(): Observable<void> {
    return this.http.post<void>('/api/company/leave', {});
  }

  inviteMember(payload: InviteMemberPayload): Observable<void> {
    return this.http.post<void>('/api/company/invitations', payload);
  }

  acceptInvitation(token: string): Observable<CompanySummaryDto> {
    return this.http.post<CompanySummaryDto>('/api/company/invitations/accept', { token });
  }
}

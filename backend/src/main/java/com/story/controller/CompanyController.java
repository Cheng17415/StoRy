package com.story.controller;

import com.story.model.company.AcceptInvitationRequest;
import com.story.model.company.CompanyPageDto;
import com.story.model.company.CompanyMemberDto;
import com.story.model.company.CompanySummaryDto;
import com.story.model.company.CreateCompanyRequest;
import com.story.model.company.CompanyInvitationDto;
import com.story.model.company.InviteCompanyMemberRequest;
import com.story.model.company.JoinCompanyRequest;
import com.story.service.CompanyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/company")
public class CompanyController {

    private final CompanyService companyService;

    public CompanyController(CompanyService companyService) {
        this.companyService = companyService;
    }

    @PostMapping("/create")
    @ResponseStatus(HttpStatus.CREATED)
    public CompanySummaryDto create(@Valid @RequestBody CreateCompanyRequest request) {
        return companyService.createCompany(request);
    }

    @PostMapping("/join")
    public CompanySummaryDto join(@Valid @RequestBody JoinCompanyRequest request) {
        return companyService.joinCompany(request);
    }

    @PostMapping("/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave() {
        companyService.leaveCurrentCompany();
    }

    @PostMapping("/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    public CompanyInvitationDto invite(@Valid @RequestBody InviteCompanyMemberRequest request) {
        return companyService.invite(request);
    }

    @PostMapping("/invitations/accept")
    public CompanySummaryDto accept(@Valid @RequestBody AcceptInvitationRequest request) {
        return companyService.acceptInvitation(request.token());
    }

    @GetMapping("/me")
    public CompanySummaryDto myCompany() {
        return companyService.getCurrentCompanySummary();
    }

    @GetMapping
    public CompanyPageDto companyPage() {
        return companyService.getCurrentCompanyPage();
    }

    @GetMapping("/members")
    public List<CompanyMemberDto> members() {
        return companyService.getCurrentCompanyPage().members();
    }

    @GetMapping("/invitations")
    public List<CompanyInvitationDto> invitations() {
        return companyService.getCurrentCompanyPage().invitations();
    }
}

package com.story.controller;

import com.story.model.company.AcceptInvitationRequest;
import com.story.model.company.CompanyPageDto;
import com.story.model.company.CompanyMemberDto;
import com.story.model.company.CompanySummaryDto;
import com.story.model.company.CreateCompanyRequest;
import com.story.model.company.CompanyInvitationDto;
import com.story.model.company.InviteCompanyMemberRequest;
import com.story.model.company.JoinCompanyRequest;
import com.story.model.company.UpdateCompanyCurrencyRequest;
import com.story.model.company.UpdateCompanyMemberRoleRequest;
import com.story.model.company.UpdateCompanyNameRequest;
import com.story.model.company.UpdateCompanyPasswordRequest;
import com.story.service.CompanyMemberService;
import com.story.service.CompanyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/company")
public class CompanyController {

    private final CompanyService companyService;
    private final CompanyMemberService companyMemberService;

    public CompanyController(CompanyService companyService, CompanyMemberService companyMemberService) {
        this.companyService = companyService;
        this.companyMemberService = companyMemberService;
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
        return companyMemberService.invite(request);
    }

    @PostMapping("/invitations/accept")
    public CompanySummaryDto accept(@Valid @RequestBody AcceptInvitationRequest request) {
        return companyMemberService.acceptInvitation(request.token());
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
        return companyMemberService.listMembersForCurrentCompany();
    }

    @PutMapping("/currency")
    public CompanySummaryDto updateCurrency(@Valid @RequestBody UpdateCompanyCurrencyRequest request) {
        return companyService.updateCurrency(request);
    }

    @PutMapping("/name")
    public CompanySummaryDto updateName(@Valid @RequestBody UpdateCompanyNameRequest request) {
        return companyService.updateName(request);
    }

    @PutMapping("/password")
    public CompanySummaryDto updatePassword(@Valid @RequestBody UpdateCompanyPasswordRequest request) {
        return companyService.updatePassword(request);
    }

    @DeleteMapping("/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(@PathVariable Long userId) {
        companyMemberService.removeMember(userId);
    }

    @PatchMapping("/members/{userId}/role")
    public CompanyMemberDto updateMemberRole(
            @PathVariable Long userId,
            @Valid @RequestBody UpdateCompanyMemberRoleRequest request
    ) {
        return companyMemberService.updateMemberRole(userId, request);
    }

    @GetMapping("/invitations")
    public List<CompanyInvitationDto> invitations() {
        return companyMemberService.listInvitationsForCurrentCompany();
    }
}

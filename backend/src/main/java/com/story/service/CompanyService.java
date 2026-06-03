package com.story.service;

import com.story.model.Company;
import com.story.model.CompanyMember;
import com.story.model.CompanyRole;
import com.story.model.Usuario;
import com.story.model.company.CompanyPageDto;
import com.story.model.company.CompanySummaryDto;
import com.story.model.company.CreateCompanyRequest;
import com.story.model.company.JoinCompanyRequest;
import com.story.model.company.UpdateCompanyCurrencyRequest;
import com.story.model.company.UpdateCompanyNameRequest;
import com.story.model.company.UpdateCompanyPasswordRequest;
import com.story.model.CompanyCurrency;
import com.story.repository.CompanyInvitationRepository;
import com.story.repository.CompanyMemberRepository;
import com.story.repository.CompanyRepository;
import com.story.repository.ProductoRepository;
import com.story.security.CompanyAdminMessages;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.function.Consumer;

@Service
public class CompanyService {

    private final CompanyRepository companyRepository;
    private final CompanyMemberRepository companyMemberRepository;
    private final CompanyInvitationRepository companyInvitationRepository;
    private final ProductoRepository productoRepository;
    private final CompanyMemberService companyMemberService;
    private final CurrentUserService currentUserService;
    private final PasswordEncoder passwordEncoder;

    public CompanyService(
            CompanyRepository companyRepository,
            CompanyMemberRepository companyMemberRepository,
            CompanyInvitationRepository companyInvitationRepository,
            ProductoRepository productoRepository,
            CompanyMemberService companyMemberService,
            CurrentUserService currentUserService,
            PasswordEncoder passwordEncoder
    ) {
        this.companyRepository = companyRepository;
        this.companyMemberRepository = companyMemberRepository;
        this.companyInvitationRepository = companyInvitationRepository;
        this.productoRepository = productoRepository;
        this.companyMemberService = companyMemberService;
        this.currentUserService = currentUserService;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public CompanySummaryDto createCompany(CreateCompanyRequest request) {
        Usuario user = currentUserService.requireCurrentUsuario();
        companyMemberService.ensureUserHasNoCompany(user.getId());
        String normalizedName = request.name().trim();
        if (companyRepository.existsByNameIgnoreCase(normalizedName)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El nombre de empresa ya existe");
        }

        Company company = new Company();
        company.setName(normalizedName);
        company.setPasswordHash(passwordEncoder.encode(request.password()));
        company.setCurrency(request.currency());
        company.setCreatedByUser(user);
        company = companyRepository.save(company);

        CompanyMember member = companyMemberService.createAndSaveMember(company, user, CompanyRole.company_admin);
        companyMemberService.migrateUserProductsToCompany(user.getId(), company);
        return toSummary(member);
    }

    @Transactional
    public CompanySummaryDto joinCompany(JoinCompanyRequest request) {
        Usuario user = currentUserService.requireCurrentUsuario();
        companyMemberService.ensureUserHasNoCompany(user.getId());
        Company company = companyRepository.findByNameIgnoreCase(request.name().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada"));
        if (!passwordEncoder.matches(request.password(), company.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Contraseña de empresa incorrecta");
        }

        CompanyMember member = companyMemberService.createAndSaveMember(company, user, CompanyRole.employee);
        companyMemberService.migrateUserProductsToCompany(user.getId(), company);
        return toSummary(member);
    }

    @Transactional
    public void leaveCurrentCompany() {
        CompanyMember member = currentUserService.requireCurrentCompanyMember();
        Long companyId = member.getCompany().getId();
        long membersCount = companyMemberRepository.countByCompany_Id(companyId);

        if (member.getRole() == CompanyRole.company_admin && membersCount == 1) {
            productoRepository.deleteByCompany_Id(companyId);
            companyInvitationRepository.deleteByCompany_Id(companyId);
            companyMemberRepository.deleteByCompany_Id(companyId);
            companyRepository.deleteById(companyId);
            return;
        }

        companyMemberRepository.delete(member);
    }

    @Transactional(readOnly = true)
    public CompanyPageDto getCurrentCompanyPage() {
        CompanyMember currentMember = currentUserService.requireCurrentCompanyMember();
        return new CompanyPageDto(
                toSummary(currentMember),
                companyMemberService.listMembersForCurrentCompany(),
                companyMemberService.listInvitationsForCurrentCompany()
        );
    }

    @Transactional(readOnly = true)
    public CompanySummaryDto getCurrentCompanySummary() {
        CompanyMember member = currentUserService.requireCurrentCompanyMember();
        return toSummary(member);
    }

    @Transactional
    public CompanySummaryDto updateCurrency(UpdateCompanyCurrencyRequest request) {
        AdminCompanyContext ctx = requireAdminCompanyContext(CompanyAdminMessages.UPDATE_CURRENCY);
        CompanyCurrency newCurrency = request.currency();
        if (ctx.company().getCurrency() == newCurrency) {
            return toSummary(ctx.member());
        }
        ctx.company().setCurrency(newCurrency);
        return saveCompanyAndSummarize(ctx);
    }

    @Transactional
    public CompanySummaryDto updateName(UpdateCompanyNameRequest request) {
        return mutateCompanyAsAdmin(CompanyAdminMessages.UPDATE_NAME, company -> {
            String normalizedName = request.name().trim();
            if (normalizedName.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre no puede estar vacío");
            }
            companyRepository.findByNameIgnoreCase(normalizedName)
                    .filter(existing -> !existing.getId().equals(company.getId()))
                    .ifPresent(existing -> {
                        throw new ResponseStatusException(HttpStatus.CONFLICT, "El nombre de empresa ya existe");
                    });
            company.setName(normalizedName);
        });
    }

    @Transactional
    public CompanySummaryDto updatePassword(UpdateCompanyPasswordRequest request) {
        return mutateCompanyAsAdmin(CompanyAdminMessages.UPDATE_PASSWORD, company -> {
            if (!passwordEncoder.matches(request.currentPassword(), company.getPasswordHash())) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Contraseña actual incorrecta");
            }
            company.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        });
    }

    private record AdminCompanyContext(CompanyMember member, Company company) {
    }

    private AdminCompanyContext requireAdminCompanyContext(String adminActionMessage) {
        currentUserService.requireCompanyAdmin(adminActionMessage);
        CompanyMember member = currentUserService.requireCurrentCompanyMember();
        return new AdminCompanyContext(member, member.getCompany());
    }

    private CompanySummaryDto mutateCompanyAsAdmin(String adminActionMessage, Consumer<Company> mutation) {
        AdminCompanyContext ctx = requireAdminCompanyContext(adminActionMessage);
        mutation.accept(ctx.company());
        return saveCompanyAndSummarize(ctx);
    }

    private CompanySummaryDto saveCompanyAndSummarize(AdminCompanyContext ctx) {
        companyRepository.save(ctx.company());
        return toSummary(ctx.member());
    }

    private CompanySummaryDto toSummary(CompanyMember member) {
        return new CompanySummaryDto(
                member.getCompany().getId(),
                member.getCompany().getName(),
                member.getCompany().getCurrency().name(),
                member.getRole().name()
        );
    }
}

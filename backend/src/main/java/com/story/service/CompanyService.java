package com.story.service;

import com.story.model.Company;
import com.story.model.CompanyInvitation;
import com.story.model.CompanyMember;
import com.story.model.CompanyMemberId;
import com.story.model.CompanyRole;
import com.story.model.InvitationStatus;
import com.story.model.Producto;
import com.story.model.Usuario;
import com.story.model.company.CompanyInvitationDto;
import com.story.model.company.CompanyMemberDto;
import com.story.model.company.CompanyPageDto;
import com.story.model.company.CompanySummaryDto;
import com.story.model.company.CreateCompanyRequest;
import com.story.model.company.InviteCompanyMemberRequest;
import com.story.model.company.JoinCompanyRequest;
import com.story.model.company.UpdateCompanyMemberRoleRequest;
import com.story.repository.CompanyInvitationRepository;
import com.story.repository.CompanyMemberRepository;
import com.story.repository.CompanyRepository;
import com.story.repository.ProductoRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
public class CompanyService {

    private static final Duration INVITATION_TTL = Duration.ofDays(7);

    private final CompanyRepository companyRepository;
    private final CompanyMemberRepository companyMemberRepository;
    private final CompanyInvitationRepository companyInvitationRepository;
    private final ProductoRepository productoRepository;
    private final CurrentUserService currentUserService;
    private final PasswordEncoder passwordEncoder;
    private final ResendEmailService resendEmailService;

    public CompanyService(
            CompanyRepository companyRepository,
            CompanyMemberRepository companyMemberRepository,
            CompanyInvitationRepository companyInvitationRepository,
            ProductoRepository productoRepository,
            CurrentUserService currentUserService,
            PasswordEncoder passwordEncoder,
            ResendEmailService resendEmailService
    ) {
        this.companyRepository = companyRepository;
        this.companyMemberRepository = companyMemberRepository;
        this.companyInvitationRepository = companyInvitationRepository;
        this.productoRepository = productoRepository;
        this.currentUserService = currentUserService;
        this.passwordEncoder = passwordEncoder;
        this.resendEmailService = resendEmailService;
    }

    @Transactional
    public CompanySummaryDto createCompany(CreateCompanyRequest request) {
        Usuario user = currentUserService.requireCurrentUsuario();
        ensureUserHasNoCompany(user.getId());
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

        CompanyMember member = new CompanyMember();
        member.setId(new CompanyMemberId(company.getId(), user.getId()));
        member.setCompany(company);
        member.setUser(user);
        member.setRole(CompanyRole.company_admin);
        member.setJoinedAt(Instant.now());
        companyMemberRepository.save(member);

        migrateUserProductsToCompany(user.getId(), company);
        return toSummary(member);
    }

    @Transactional
    public CompanySummaryDto joinCompany(JoinCompanyRequest request) {
        Usuario user = currentUserService.requireCurrentUsuario();
        ensureUserHasNoCompany(user.getId());
        Company company = companyRepository.findByNameIgnoreCase(request.name().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada"));
        if (!passwordEncoder.matches(request.password(), company.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Contraseña de empresa incorrecta");
        }

        CompanyMember member = new CompanyMember();
        member.setId(new CompanyMemberId(company.getId(), user.getId()));
        member.setCompany(company);
        member.setUser(user);
        member.setRole(CompanyRole.employee);
        member.setJoinedAt(Instant.now());
        companyMemberRepository.save(member);
        migrateUserProductsToCompany(user.getId(), company);
        return toSummary(member);
    }

    @Transactional
    public void leaveCurrentCompany() {
        CompanyMember member = currentUserService.requireCurrentCompanyMember();
        Long companyId = member.getCompany().getId();
        long membersCount = companyMemberRepository.countByCompany_Id(companyId);

        if (member.getRole() == CompanyRole.company_admin && membersCount == 1) {
            // Si eres el ultimo propietario, abandonar equivale a eliminar la empresa completa.
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
        Company company = currentMember.getCompany();
        List<CompanyMemberDto> members = companyMemberRepository.findByCompany_IdOrderByJoinedAtAsc(company.getId()).stream()
                .map(this::toMemberDto)
                .toList();
        List<CompanyInvitationDto> invitations = companyInvitationRepository.findByCompany_IdOrderByCreatedAtDesc(company.getId()).stream()
                .map(this::toInvitationDto)
                .toList();
        return new CompanyPageDto(toSummary(currentMember), members, invitations);
    }

    @Transactional(readOnly = true)
    public CompanySummaryDto getCurrentCompanySummary() {
        CompanyMember member = currentUserService.requireCurrentCompanyMember();
        return toSummary(member);
    }

    @Transactional
    public CompanyMemberDto updateMemberRole(Long targetUserId, UpdateCompanyMemberRoleRequest request) {
        CompanyMember currentMember = currentUserService.requireCurrentCompanyMember();
        if (currentMember.getRole() != CompanyRole.company_admin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo company_admin puede cambiar roles");
        }

        Long companyId = currentMember.getCompany().getId();
        CompanyMember targetMember = companyMemberRepository.findById(new CompanyMemberId(companyId, targetUserId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Miembro no encontrado"));

        CompanyRole newRole = request.role();
        if (targetMember.getRole() == newRole) {
            return toMemberDto(targetMember);
        }

        if (targetMember.getRole() == CompanyRole.company_admin && newRole != CompanyRole.company_admin) {
            long adminCount = companyMemberRepository.countByCompany_IdAndRole(companyId, CompanyRole.company_admin);
            if (adminCount <= 1) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "La empresa debe tener al menos un propietario"
                );
            }
        }

        targetMember.setRole(newRole);
        companyMemberRepository.save(targetMember);
        return toMemberDto(targetMember);
    }

    @Transactional
    public CompanyInvitationDto invite(InviteCompanyMemberRequest request) {
        CompanyMember inviterMember = currentUserService.requireCurrentCompanyMember();
        if (inviterMember.getRole() != CompanyRole.company_admin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo company_admin puede invitar miembros");
        }

        String email = request.email().trim().toLowerCase();
        companyInvitationRepository.findByCompany_IdAndEmailIgnoreCaseAndStatus(
                        inviterMember.getCompany().getId(), email, InvitationStatus.PENDING
                )
                .ifPresent(existing -> {
                    if (existing.getExpiresAt().isAfter(Instant.now())) {
                        throw new ResponseStatusException(
                                HttpStatus.CONFLICT,
                                "Ya hay una invitacion pendiente para este correo"
                        );
                    }
                });

        String rawToken = UUID.randomUUID() + "." + UUID.randomUUID();
        String tokenHash = hashToken(rawToken);
        Instant expiresAt = Instant.now().plus(INVITATION_TTL);

        CompanyInvitation invitation = new CompanyInvitation();
        invitation.setCompany(inviterMember.getCompany());
        invitation.setEmail(email);
        invitation.setRole(request.role());
        invitation.setStatus(InvitationStatus.PENDING);
        invitation.setTokenHash(tokenHash);
        invitation.setExpiresAt(expiresAt);
        invitation.setInvitedByUser(inviterMember.getUser());
        invitation.setCreatedAt(Instant.now());
        invitation = companyInvitationRepository.save(invitation);

        String url = resendEmailService.buildInvitationUrl(rawToken);
        resendEmailService.sendInvitationEmail(
                email,
                inviterMember.getCompany().getName(),
                request.role().name(),
                url,
                "company-invite/" + invitation.getId()
        );
        return toInvitationDto(invitation);
    }

    @Transactional
    public CompanySummaryDto acceptInvitation(String token) {
        Usuario user = currentUserService.requireCurrentUsuario();
        ensureUserHasNoCompany(user.getId());

        CompanyInvitation invitation = companyInvitationRepository.findByTokenHash(hashToken(token))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitacion no valida"));
        if (invitation.getStatus() != InvitationStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La invitacion ya no esta disponible");
        }
        if (invitation.getExpiresAt().isBefore(Instant.now())) {
            invitation.setStatus(InvitationStatus.EXPIRED);
            companyInvitationRepository.save(invitation);
            throw new ResponseStatusException(HttpStatus.GONE, "La invitacion ha expirado");
        }
        if (!user.getEmail().equalsIgnoreCase(invitation.getEmail())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Este enlace no corresponde a tu correo");
        }

        CompanyMember member = new CompanyMember();
        member.setId(new CompanyMemberId(invitation.getCompany().getId(), user.getId()));
        member.setCompany(invitation.getCompany());
        member.setUser(user);
        member.setRole(invitation.getRole());
        member.setJoinedAt(Instant.now());
        companyMemberRepository.save(member);

        invitation.setStatus(InvitationStatus.ACCEPTED);
        invitation.setAcceptedAt(Instant.now());
        invitation.setAcceptedByUser(user);
        companyInvitationRepository.save(invitation);

        migrateUserProductsToCompany(user.getId(), invitation.getCompany());
        return toSummary(member);
    }

    @Transactional
    public void markExpiredInvitations() {
        List<CompanyInvitation> expired = companyInvitationRepository.findByStatusAndExpiresAtBefore(
                InvitationStatus.PENDING,
                Instant.now()
        );
        for (CompanyInvitation invitation : expired) {
            invitation.setStatus(InvitationStatus.EXPIRED);
        }
        companyInvitationRepository.saveAll(expired);
    }

    private void ensureUserHasNoCompany(Long userId) {
        if (companyMemberRepository.findByUser_Id(userId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya perteneces a una empresa");
        }
    }

    private void migrateUserProductsToCompany(Long userId, Company company) {
        List<Producto> userProducts = productoRepository.findByUsuario_Id(userId);
        for (Producto product : userProducts) {
            product.setCompany(company);
        }
        productoRepository.saveAll(userProducts);
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }

    private CompanySummaryDto toSummary(CompanyMember member) {
        return new CompanySummaryDto(
                member.getCompany().getId(),
                member.getCompany().getName(),
                member.getCompany().getCurrency().name(),
                member.getRole().name()
        );
    }

    private CompanyMemberDto toMemberDto(CompanyMember member) {
        Usuario user = member.getUser();
        return new CompanyMemberDto(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getUsername(),
                member.getRole().name(),
                member.getJoinedAt()
        );
    }

    private CompanyInvitationDto toInvitationDto(CompanyInvitation invitation) {
        return new CompanyInvitationDto(
                invitation.getId(),
                invitation.getEmail(),
                invitation.getRole().name(),
                invitation.getStatus().name(),
                invitation.getExpiresAt(),
                invitation.getCreatedAt()
        );
    }
}

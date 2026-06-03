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
import com.story.model.company.CompanySummaryDto;
import com.story.model.company.InviteCompanyMemberRequest;
import com.story.model.company.UpdateCompanyMemberRoleRequest;
import com.story.repository.CompanyInvitationRepository;
import com.story.repository.CompanyMemberRepository;
import com.story.repository.ProductoRepository;
import com.story.security.CompanyAdminMessages;
import org.springframework.http.HttpStatus;
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
public class CompanyMemberService {

    private static final Duration INVITATION_TTL = Duration.ofDays(7);

    private final CompanyMemberRepository companyMemberRepository;
    private final CompanyInvitationRepository companyInvitationRepository;
    private final ProductoRepository productoRepository;
    private final CurrentUserService currentUserService;
    private final ResendEmailService resendEmailService;

    public CompanyMemberService(
            CompanyMemberRepository companyMemberRepository,
            CompanyInvitationRepository companyInvitationRepository,
            ProductoRepository productoRepository,
            CurrentUserService currentUserService,
            ResendEmailService resendEmailService
    ) {
        this.companyMemberRepository = companyMemberRepository;
        this.companyInvitationRepository = companyInvitationRepository;
        this.productoRepository = productoRepository;
        this.currentUserService = currentUserService;
        this.resendEmailService = resendEmailService;
    }

    @Transactional(readOnly = true)
    public List<CompanyMemberDto> listMembersForCurrentCompany() {
        Long companyId = currentUserService.requireCurrentCompanyId();
        return companyMemberRepository.findByCompany_IdOrderByJoinedAtAsc(companyId).stream()
                .map(this::toMemberDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CompanyInvitationDto> listInvitationsForCurrentCompany() {
        Long companyId = currentUserService.requireCurrentCompanyId();
        return companyInvitationRepository.findByCompany_IdOrderByCreatedAtDesc(companyId).stream()
                .map(this::toInvitationDto)
                .toList();
    }

    public void ensureUserHasNoCompany(Long userId) {
        if (companyMemberRepository.findByUser_Id(userId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya perteneces a una empresa");
        }
    }

    @Transactional
    public CompanyMember createAndSaveMember(Company company, Usuario user, CompanyRole role) {
        CompanyMember member = new CompanyMember();
        member.setId(new CompanyMemberId(company.getId(), user.getId()));
        member.setCompany(company);
        member.setUser(user);
        member.setRole(role);
        member.setJoinedAt(Instant.now());
        return companyMemberRepository.save(member);
    }

    @Transactional
    public void migrateUserProductsToCompany(Long userId, Company company) {
        List<Producto> userProducts = productoRepository.findByUsuario_Id(userId);
        for (Producto product : userProducts) {
            product.setCompany(company);
        }
        productoRepository.saveAll(userProducts);
    }

    @Transactional
    public void removeMember(Long targetUserId) {
        currentUserService.requireCompanyAdmin(CompanyAdminMessages.REMOVE_MEMBER);
        CompanyMember currentMember = currentUserService.requireCurrentCompanyMember();
        Long companyId = currentMember.getCompany().getId();
        if (targetUserId.equals(currentMember.getUser().getId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "No puedes eliminarte a ti mismo; usa abandonar empresa"
            );
        }
        CompanyMember targetMember = requireMemberInCompany(companyId, targetUserId);
        ensureCompanyRetainsAdmin(companyId, targetMember, null);
        companyMemberRepository.delete(targetMember);
    }

    @Transactional
    public CompanyMemberDto updateMemberRole(Long targetUserId, UpdateCompanyMemberRoleRequest request) {
        currentUserService.requireCompanyAdmin(CompanyAdminMessages.CHANGE_MEMBER_ROLE);
        Long companyId = currentUserService.requireCurrentCompanyId();
        CompanyMember targetMember = requireMemberInCompany(companyId, targetUserId);

        CompanyRole newRole = request.role();
        if (targetMember.getRole() == newRole) {
            return toMemberDto(targetMember);
        }

        ensureCompanyRetainsAdmin(companyId, targetMember, newRole);
        targetMember.setRole(newRole);
        companyMemberRepository.save(targetMember);
        return toMemberDto(targetMember);
    }

    @Transactional
    public CompanyInvitationDto invite(InviteCompanyMemberRequest request) {
        currentUserService.requireCompanyAdmin(CompanyAdminMessages.INVITE_MEMBER);
        CompanyMember inviterMember = currentUserService.requireCurrentCompanyMember();

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

        CompanyMember member = createAndSaveMember(invitation.getCompany(), user, invitation.getRole());

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

    private CompanyMember requireMemberInCompany(Long companyId, Long userId) {
        return companyMemberRepository.findById(new CompanyMemberId(companyId, userId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Miembro no encontrado"));
    }

    /**
     * @param newRole null cuando el miembro se elimina (deja de ser admin sin reemplazo de rol).
     */
    private void ensureCompanyRetainsAdmin(Long companyId, CompanyMember target, CompanyRole newRole) {
        if (target.getRole() != CompanyRole.company_admin) {
            return;
        }
        boolean staysAdmin = newRole == CompanyRole.company_admin;
        if (newRole == null || !staysAdmin) {
            long adminCount = companyMemberRepository.countByCompany_IdAndRole(companyId, CompanyRole.company_admin);
            if (adminCount <= 1) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "La empresa debe tener al menos un propietario"
                );
            }
        }
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

package com.story.repository;

import com.story.model.CompanyInvitation;
import com.story.model.InvitationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface CompanyInvitationRepository extends JpaRepository<CompanyInvitation, Long> {

    Optional<CompanyInvitation> findByTokenHash(String tokenHash);

    List<CompanyInvitation> findByCompany_IdOrderByCreatedAtDesc(Long companyId);

    Optional<CompanyInvitation> findByCompany_IdAndEmailIgnoreCaseAndStatus(Long companyId, String email, InvitationStatus status);

    List<CompanyInvitation> findByStatusAndExpiresAtBefore(InvitationStatus status, Instant expiresAt);

    void deleteByCompany_Id(Long companyId);
}

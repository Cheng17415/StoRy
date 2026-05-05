package com.story.repository;

import com.story.model.CompanyMember;
import com.story.model.CompanyMemberId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CompanyMemberRepository extends JpaRepository<CompanyMember, CompanyMemberId> {

    Optional<CompanyMember> findByUser_Id(Long userId);

    List<CompanyMember> findByCompany_IdOrderByJoinedAtAsc(Long companyId);

    long countByCompany_Id(Long companyId);

    boolean existsByCompany_IdAndUser_Id(Long companyId, Long userId);

    void deleteByCompany_Id(Long companyId);
}

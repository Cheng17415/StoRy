package com.story.service;

import com.story.model.CompanyMember;
import com.story.model.Usuario;
import com.story.model.auth.AuthUserDto;
import com.story.repository.CompanyMemberRepository;
import org.springframework.stereotype.Component;

@Component
public class AuthUserMapper {

    private final CompanyMemberRepository companyMemberRepository;

    public AuthUserMapper(CompanyMemberRepository companyMemberRepository) {
        this.companyMemberRepository = companyMemberRepository;
    }

    public AuthUserDto toDto(Usuario user) {
        CompanyMember member = companyMemberRepository.findByUser_Id(user.getId()).orElse(null);
        Long companyId = null;
        String companyName = null;
        String companyCurrency = null;
        String companyRole = null;
        if (member != null) {
            companyId = member.getCompany().getId();
            companyName = member.getCompany().getName();
            companyCurrency = member.getCompany().getCurrency().name();
            companyRole = member.getRole().name();
        }
        return new AuthUserDto(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getUsername(),
                user.getProvider().name(),
                user.isGoogleConnected(),
                companyId,
                companyName,
                companyCurrency,
                companyRole
        );
    }
}

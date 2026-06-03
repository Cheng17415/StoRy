package com.story;

import com.story.model.Company;
import com.story.model.CompanyMember;
import com.story.model.CompanyMemberId;
import com.story.model.CompanyRole;
import com.story.model.Usuario;
import com.story.repository.CompanyInvitationRepository;
import com.story.repository.CompanyMemberRepository;
import com.story.repository.CompanyRepository;
import com.story.repository.ProductoRepository;
import com.story.service.CompanyMemberService;
import com.story.service.CompanyService;
import com.story.service.CurrentUserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CompanyServiceLeaveTest {

    @Mock
    private CompanyRepository companyRepository;
    @Mock
    private CompanyMemberRepository companyMemberRepository;
    @Mock
    private CompanyInvitationRepository companyInvitationRepository;
    @Mock
    private ProductoRepository productoRepository;
    @Mock
    private CurrentUserService currentUserService;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private CompanyMemberService companyMemberService;

    @InjectMocks
    private CompanyService companyService;

    @Test
    void leaveCompany_whenSoleAdmin_deletesWholeCompany() {
        CompanyMember member = buildMember(CompanyRole.company_admin, 44L, 8L);
        when(currentUserService.requireCurrentCompanyMember()).thenReturn(member);
        when(companyMemberRepository.countByCompany_Id(44L)).thenReturn(1L);

        companyService.leaveCurrentCompany();

        verify(productoRepository).deleteByCompany_Id(44L);
        verify(companyInvitationRepository).deleteByCompany_Id(44L);
        verify(companyMemberRepository).deleteByCompany_Id(44L);
        verify(companyRepository).deleteById(44L);
    }

    @Test
    void leaveCompany_whenNotSoleAdmin_onlyRemovesMembership() {
        CompanyMember member = buildMember(CompanyRole.company_admin, 44L, 8L);
        when(currentUserService.requireCurrentCompanyMember()).thenReturn(member);
        when(companyMemberRepository.countByCompany_Id(44L)).thenReturn(2L);

        companyService.leaveCurrentCompany();

        verify(companyMemberRepository).delete(member);
    }

    private CompanyMember buildMember(CompanyRole role, Long companyId, Long userId) {
        Company company = new Company();
        company.setId(companyId);
        Usuario user = new Usuario();
        user.setId(userId);

        CompanyMember member = new CompanyMember();
        member.setId(new CompanyMemberId(companyId, userId));
        member.setCompany(company);
        member.setUser(user);
        member.setRole(role);
        return member;
    }
}

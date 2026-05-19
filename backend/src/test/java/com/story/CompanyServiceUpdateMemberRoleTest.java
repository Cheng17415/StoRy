package com.story;

import com.story.model.Company;
import com.story.model.CompanyMember;
import com.story.model.CompanyMemberId;
import com.story.model.CompanyRole;
import com.story.model.Usuario;
import com.story.model.company.CompanyMemberDto;
import com.story.model.company.UpdateCompanyMemberRoleRequest;
import com.story.repository.CompanyInvitationRepository;
import com.story.repository.CompanyMemberRepository;
import com.story.repository.CompanyRepository;
import com.story.repository.ProductoRepository;
import com.story.service.CompanyService;
import com.story.service.CurrentUserService;
import com.story.service.ResendEmailService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CompanyServiceUpdateMemberRoleTest {

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
    private ResendEmailService resendEmailService;

    @InjectMocks
    private CompanyService companyService;

    @Test
    void updateMemberRole_whenAdmin_updatesTargetMember() {
        CompanyMember admin = buildMember(CompanyRole.company_admin, 44L, 8L);
        CompanyMember employee = buildMember(CompanyRole.employee, 44L, 12L);
        when(currentUserService.requireCurrentCompanyMember()).thenReturn(admin);
        when(companyMemberRepository.findById(new CompanyMemberId(44L, 12L))).thenReturn(Optional.of(employee));

        CompanyMemberDto result = companyService.updateMemberRole(
                12L,
                new UpdateCompanyMemberRoleRequest(CompanyRole.analytics_viewer)
        );

        assertThat(result.role()).isEqualTo("analytics_viewer");
        assertThat(employee.getRole()).isEqualTo(CompanyRole.analytics_viewer);
        verify(companyMemberRepository).save(employee);
    }

    @Test
    void updateMemberRole_whenNotAdmin_forbidden() {
        CompanyMember employee = buildMember(CompanyRole.employee, 44L, 8L);
        when(currentUserService.requireCurrentCompanyMember()).thenReturn(employee);

        assertThatThrownBy(() -> companyService.updateMemberRole(
                12L,
                new UpdateCompanyMemberRoleRequest(CompanyRole.employee)
        ))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Solo company_admin puede cambiar roles");
    }

    @Test
    void updateMemberRole_whenDemotingLastAdmin_conflict() {
        CompanyMember admin = buildMember(CompanyRole.company_admin, 44L, 8L);
        when(currentUserService.requireCurrentCompanyMember()).thenReturn(admin);
        when(companyMemberRepository.findById(new CompanyMemberId(44L, 8L))).thenReturn(Optional.of(admin));
        when(companyMemberRepository.countByCompany_IdAndRole(44L, CompanyRole.company_admin)).thenReturn(1L);

        assertThatThrownBy(() -> companyService.updateMemberRole(
                8L,
                new UpdateCompanyMemberRoleRequest(CompanyRole.employee)
        ))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("al menos un propietario");

        verify(companyMemberRepository, never()).save(any());
    }

    private CompanyMember buildMember(CompanyRole role, Long companyId, Long userId) {
        Company company = new Company();
        company.setId(companyId);
        Usuario user = new Usuario();
        user.setId(userId);
        user.setName("User " + userId);
        user.setEmail("user" + userId + "@example.com");
        user.setUsername("user" + userId);

        CompanyMember member = new CompanyMember();
        member.setId(new CompanyMemberId(companyId, userId));
        member.setCompany(company);
        member.setUser(user);
        member.setRole(role);
        return member;
    }
}

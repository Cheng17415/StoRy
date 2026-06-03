package com.story;

import com.story.model.Company;
import com.story.model.CompanyCurrency;
import com.story.model.CompanyMember;
import com.story.model.CompanyMemberId;
import com.story.model.CompanyRole;
import com.story.model.Usuario;
import com.story.model.company.CompanySummaryDto;
import com.story.model.company.UpdateCompanyCurrencyRequest;
import com.story.repository.CompanyInvitationRepository;
import com.story.repository.CompanyMemberRepository;
import com.story.repository.CompanyRepository;
import com.story.repository.ProductoRepository;
import com.story.security.CompanyAdminMessages;
import com.story.service.CompanyMemberService;
import com.story.service.CompanyService;
import com.story.service.CurrentUserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CompanyServiceUpdateCurrencyTest {

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
    void updateCurrency_whenAdmin_updatesCompany() {
        CompanyMember admin = buildMember(CompanyRole.company_admin, CompanyCurrency.EUR);
        when(currentUserService.requireCurrentCompanyMember()).thenReturn(admin);
        org.mockito.Mockito.doNothing().when(currentUserService).requireCompanyAdmin(CompanyAdminMessages.UPDATE_CURRENCY);

        CompanySummaryDto result = companyService.updateCurrency(
                new UpdateCompanyCurrencyRequest(CompanyCurrency.USD)
        );

        assertThat(result.currency()).isEqualTo("USD");
        assertThat(admin.getCompany().getCurrency()).isEqualTo(CompanyCurrency.USD);
        verify(companyRepository).save(admin.getCompany());
    }

    @Test
    void updateCurrency_whenNotAdmin_forbidden() {
        org.mockito.Mockito.doThrow(new ResponseStatusException(
                org.springframework.http.HttpStatus.FORBIDDEN,
                CompanyAdminMessages.UPDATE_CURRENCY
        )).when(currentUserService).requireCompanyAdmin(CompanyAdminMessages.UPDATE_CURRENCY);

        assertThatThrownBy(() -> companyService.updateCurrency(
                new UpdateCompanyCurrencyRequest(CompanyCurrency.USD)
        ))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("moneda");

        verify(companyRepository, never()).save(any());
    }

    private CompanyMember buildMember(CompanyRole role, CompanyCurrency currency) {
        Company company = new Company();
        company.setId(44L);
        company.setName("Acme");
        company.setCurrency(currency);
        Usuario user = new Usuario();
        user.setId(8L);
        user.setName("Admin");
        user.setEmail("admin@example.com");
        user.setUsername("admin");

        CompanyMember member = new CompanyMember();
        member.setId(new CompanyMemberId(44L, 8L));
        member.setCompany(company);
        member.setUser(user);
        member.setRole(role);
        return member;
    }
}

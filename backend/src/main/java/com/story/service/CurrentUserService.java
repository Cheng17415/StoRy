package com.story.service;

import com.story.model.Usuario;
import com.story.model.CompanyMember;
import com.story.model.CompanyRole;
import com.story.repository.CompanyMemberRepository;
import com.story.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CurrentUserService {

    private final UsuarioRepository usuarioRepository;
    private final CompanyMemberRepository companyMemberRepository;

    public CurrentUserService(UsuarioRepository usuarioRepository, CompanyMemberRepository companyMemberRepository) {
        this.usuarioRepository = usuarioRepository;
        this.companyMemberRepository = companyMemberRepository;
    }

    public Usuario requireCurrentUsuario() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sesión requerida");
        }
        String username = auth.getName();
        return usuarioRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));
    }

    public Long requireCurrentUsuarioId() {
        return requireCurrentUsuario().getId();
    }

    public CompanyMember findCurrentCompanyMemberOrNull() {
        Long userId = requireCurrentUsuarioId();
        return companyMemberRepository.findByUser_Id(userId).orElse(null);
    }

    public CompanyMember requireCurrentCompanyMember() {
        return companyMemberRepository.findByUser_Id(requireCurrentUsuarioId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "No perteneces a ninguna empresa"));
    }

    public Long requireCurrentCompanyId() {
        return requireCurrentCompanyMember().getCompany().getId();
    }

    public CompanyRole requireCurrentCompanyRole() {
        return requireCurrentCompanyMember().getRole();
    }

    public void requireRoleAtLeastEmployee() {
        CompanyRole role = requireCurrentCompanyRole();
        if (role == CompanyRole.analytics_viewer) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tu rol es de solo lectura");
        }
    }

    public void requireCompanyAdmin() {
        CompanyRole role = requireCurrentCompanyRole();
        if (role != CompanyRole.company_admin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el administrador de empresa puede realizar esta acción");
        }
    }

    /**
     * Estadísticas agregadas de inventario: administrador de empresa o rol de lectura analítica.
     */
    public void requireCompanyAdminOrAnalyticsViewer() {
        CompanyRole role = requireCurrentCompanyRole();
        if (role != CompanyRole.company_admin && role != CompanyRole.analytics_viewer) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Solo company_admin o analytics_viewer pueden consultar estadísticas de inventario");
        }
    }
}

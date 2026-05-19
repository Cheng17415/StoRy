package com.story;

import com.story.model.Company;
import com.story.model.CompanyCurrency;
import com.story.model.CompanyRole;
import com.story.model.Producto;
import com.story.model.ProductoCarpeta;
import com.story.model.Usuario;
import com.story.repository.ProductoCarpetaRepository;
import com.story.repository.ProductoRepository;
import com.story.service.CarpetaService;
import com.story.service.CatalogoService;
import com.story.service.CurrentUserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CarpetaServiceTest {

    @Mock
    private ProductoCarpetaRepository productoCarpetaRepository;
    @Mock
    private ProductoRepository productoRepository;
    @Mock
    private CatalogoService catalogoService;
    @Mock
    private CurrentUserService currentUserService;
    @InjectMocks
    private CarpetaService carpetaService;

    @Test
    void mover_enCiclo_badRequest() {
        Company company = company(1L);
        ProductoCarpeta root = carpeta(10L, company, null);
        ProductoCarpeta child = carpeta(20L, company, root);

        doNothing().when(currentUserService).requireRoleAtLeastEmployee();
        when(currentUserService.requireCurrentCompanyId()).thenReturn(1L);
        when(productoCarpetaRepository.findByIdAndCompany_Id(10L, 1L)).thenReturn(Optional.of(root));
        when(productoCarpetaRepository.findAllByCompany_IdAndParent_IdOrderByNombreAsc(1L, 10L))
                .thenReturn(List.of(child));
        when(productoCarpetaRepository.findAllByCompany_IdAndParent_IdOrderByNombreAsc(1L, 20L))
                .thenReturn(List.of());

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> carpetaService.mover(10L, 20L)
        );
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void eliminar_eliminaProductosAntesDeCarpeta() {
        Company company = company(1L);
        ProductoCarpeta folder = carpeta(5L, company, null);
        Producto p = producto(99L, company);
        p.setCarpeta(folder);

        when(currentUserService.requireCurrentCompanyRole()).thenReturn(CompanyRole.company_admin);
        when(currentUserService.requireCurrentCompanyId()).thenReturn(1L);
        when(productoCarpetaRepository.findByIdAndCompany_Id(5L, 1L)).thenReturn(Optional.of(folder));
        when(productoCarpetaRepository.findAllByCompany_IdAndParent_IdOrderByNombreAsc(1L, 5L))
                .thenReturn(List.of());
        when(productoRepository.findAllByCompany_IdAndCarpeta_IdIn(eq(1L), ArgumentMatchers.<Set<Long>>any()))
                .thenReturn(List.of(p));

        carpetaService.eliminar(5L);

        verify(catalogoService).eliminarProductoSinChequeoAdmin(p);
        verify(productoCarpetaRepository).delete(folder);
    }

    private static Company company(Long id) {
        Company c = new Company();
        c.setId(id);
        c.setName("co");
        c.setCurrency(CompanyCurrency.EUR);
        return c;
    }

    private static ProductoCarpeta carpeta(Long id, Company company, ProductoCarpeta parent) {
        ProductoCarpeta c = new ProductoCarpeta();
        c.setId(id);
        c.setCompany(company);
        c.setParent(parent);
        c.setNombre("c" + id);
        c.setFechaCreacion(Instant.now());
        c.setFechaActualizacion(Instant.now());
        return c;
    }

    private static Producto producto(Long id, Company company) {
        Usuario u = new Usuario();
        u.setId(1L);
        u.setUsername("u");
        Producto p = new Producto();
        p.setId(id);
        p.setCompany(company);
        p.setUsuario(u);
        p.setNombre("p");
        p.setCodigo("X");
        p.setCantidad(1);
        p.setPrecio(BigDecimal.ONE);
        p.setActivo(true);
        p.setFechaCreacion(Instant.now());
        p.setFechaActualizacion(Instant.now());
        return p;
    }
}

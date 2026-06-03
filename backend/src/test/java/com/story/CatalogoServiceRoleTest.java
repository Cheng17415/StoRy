package com.story;

import com.story.model.Company;
import com.story.model.CompanyCurrency;
import com.story.model.CompanyRole;
import com.story.model.Producto;
import com.story.model.Usuario;
import com.story.repository.CategoriaRepository;
import com.story.repository.ProductoCarpetaRepository;
import com.story.repository.ProductoRepository;
import com.story.security.CompanyAdminMessages;
import com.story.service.CatalogoService;
import com.story.service.CurrentUserService;
import com.story.service.FileStorageService;
import com.story.service.InventarioService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CatalogoServiceRoleTest {

    @Mock
    private CategoriaRepository categoriaRepository;
    @Mock
    private ProductoRepository productoRepository;
    @Mock
    private ProductoCarpetaRepository productoCarpetaRepository;
    @Mock
    private FileStorageService fileStorageService;
    @Mock
    private CurrentUserService currentUserService;
    @Mock
    private InventarioService inventarioService;

    @InjectMocks
    private CatalogoService catalogoService;

    @Captor
    private ArgumentCaptor<Producto> productCaptor;

    @Test
    void eliminarProducto_employeeRole_forbidden() {
        org.mockito.Mockito.doThrow(new ResponseStatusException(
                org.springframework.http.HttpStatus.FORBIDDEN,
                CompanyAdminMessages.DELETE_PRODUCT
        )).when(currentUserService).requireCompanyAdmin(CompanyAdminMessages.DELETE_PRODUCT);

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> catalogoService.eliminarProducto(10L)
        );

        assertEquals(403, ex.getStatusCode().value());
        verify(productoRepository, never()).findByIdAndCompany_Id(any(), any());
    }

    @Test
    void actualizarProducto_employee_onlyChangesStock() {
        Producto producto = buildProducto();
        producto.setNombre("Nombre original");
        producto.setDescripcion("Descripcion original");
        producto.setPrecio(new BigDecimal("12.50"));
        producto.setStockMinimo(3);
        producto.setCantidad(5);
        producto.setImagen("old.png");

        doNothing().when(currentUserService).requireRoleAtLeastEmployee();
        when(currentUserService.requireCurrentCompanyRole()).thenReturn(CompanyRole.employee);
        when(currentUserService.requireCurrentCompanyId()).thenReturn(1L);
        when(productoRepository.findByIdAndCompany_Id(1L, 1L)).thenReturn(Optional.of(producto));

        catalogoService.actualizarProducto(
                1L,
                "Nuevo nombre",
                9,
                new BigDecimal("99.99"),
                "12",
                "Nueva descripcion",
                null,
                null
        );

        verify(productoRepository).save(productCaptor.capture());
        Producto saved = productCaptor.getValue();
        assertEquals("Nombre original", saved.getNombre());
        assertEquals("Descripcion original", saved.getDescripcion());
        assertEquals(new BigDecimal("12.50"), saved.getPrecio());
        assertEquals(3, saved.getStockMinimo());
        assertEquals(9, saved.getCantidad());
        verify(inventarioService).registrarCambioStockPorEdicion(saved, 5, 9);
    }

    @Test
    void eliminarProducto_adminRole_allowsDelete() {
        Producto producto = buildProducto();
        org.mockito.Mockito.doNothing().when(currentUserService).requireCompanyAdmin(CompanyAdminMessages.DELETE_PRODUCT);
        when(currentUserService.requireCurrentCompanyId()).thenReturn(1L);
        when(productoRepository.findByIdAndCompany_Id(1L, 1L)).thenReturn(Optional.of(producto));

        catalogoService.eliminarProducto(1L);

        verify(productoRepository).delete(producto);
    }

    private Producto buildProducto() {
        Company company = new Company();
        company.setId(1L);
        company.setName("acme");
        company.setCurrency(CompanyCurrency.EUR);
        Usuario user = new Usuario();
        user.setId(99L);
        user.setUsername("tester");

        Producto p = new Producto();
        p.setId(1L);
        p.setCompany(company);
        p.setUsuario(user);
        p.setCodigo("P-1");
        p.setFechaCreacion(Instant.now());
        p.setFechaActualizacion(Instant.now());
        p.setActivo(true);
        return p;
    }
}

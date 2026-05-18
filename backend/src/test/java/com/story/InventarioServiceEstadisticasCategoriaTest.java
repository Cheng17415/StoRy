package com.story;

import com.story.model.Categoria;
import com.story.model.Company;
import com.story.model.CompanyCurrency;
import com.story.model.MovimientoStock;
import com.story.model.Producto;
import com.story.model.TipoMovimiento;
import com.story.model.Usuario;
import com.story.repository.CategoriaRepository;
import com.story.repository.MovimientoStockRepository;
import com.story.repository.ProductoRepository;
import com.story.service.CurrentUserService;
import com.story.service.InventarioService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InventarioServiceEstadisticasCategoriaTest {

    @Mock
    private MovimientoStockRepository movimientoStockRepository;
    @Mock
    private ProductoRepository productoRepository;
    @Mock
    private CategoriaRepository categoriaRepository;
    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private InventarioService inventarioService;

    private Instant desde;
    private Instant hasta;

    @BeforeEach
    void setUp() {
        doNothing().when(currentUserService).requireCompanyAdminOrAnalyticsViewer();
        when(currentUserService.requireCurrentCompanyId()).thenReturn(1L);

        LocalDate day = LocalDate.of(2026, 1, 1);
        desde = day.atStartOfDay(ZoneOffset.UTC).toInstant();
        hasta = day.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    @Test
    void estadisticas_withCategoriaId_passesFilterToRepository() {
        Categoria categoria = new Categoria();
        categoria.setId(5L);
        categoria.setNombre("Alimentación");

        MovimientoStock movimiento = buildMovimiento(TipoMovimiento.SALIDA, 3);

        when(categoriaRepository.findByIdAndCompany_Id(5L, 1L)).thenReturn(Optional.of(categoria));
        when(movimientoStockRepository.findByCompanyAndFechaRange(1L, desde, hasta, 5L))
                .thenReturn(List.of(movimiento));

        var result = inventarioService.estadisticas(desde, hasta, 5L);

        assertEquals(1, result.totalMovimientos());
        assertEquals(3, result.unidadesSalida());
        verify(movimientoStockRepository).findByCompanyAndFechaRange(eq(1L), eq(desde), eq(hasta), eq(5L));
    }

    @Test
    void estadisticas_unknownCategoriaId_notFound() {
        when(categoriaRepository.findByIdAndCompany_Id(99L, 1L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> inventarioService.estadisticas(desde, hasta, 99L)
        );

        assertEquals(404, ex.getStatusCode().value());
    }

    private MovimientoStock buildMovimiento(TipoMovimiento tipo, int cantidad) {
        Company company = new Company();
        company.setId(1L);
        company.setName("acme");
        company.setCurrency(CompanyCurrency.EUR);

        Producto producto = new Producto();
        producto.setId(7L);
        producto.setCompany(company);
        producto.setNombre("Arroz");
        producto.setCodigo("P-7");

        Usuario usuario = new Usuario();
        usuario.setId(2L);
        usuario.setUsername("admin");

        MovimientoStock m = new MovimientoStock();
        m.setProducto(producto);
        m.setUsuario(usuario);
        m.setTipo(tipo);
        m.setCantidad(cantidad);
        m.setFecha(Instant.parse("2026-01-01T12:00:00Z"));
        return m;
    }
}

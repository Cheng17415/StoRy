package com.story;

import com.story.model.Company;
import com.story.model.MovimientoStock;
import com.story.model.Producto;
import com.story.model.TipoMovimiento;
import com.story.model.Usuario;
import com.story.repository.MovimientoStockRepository;
import com.story.repository.ProductoRepository;
import com.story.service.CurrentUserService;
import com.story.service.InventarioService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InventarioServiceRegistrarMovimientoTest {

    @Mock
    private MovimientoStockRepository movimientoStockRepository;
    @Mock
    private ProductoRepository productoRepository;
    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private InventarioService inventarioService;

    @Captor
    private ArgumentCaptor<MovimientoStock> movCaptor;

    private Producto producto;
    private Usuario usuario;

    @BeforeEach
    void setUp() {
        doNothing().when(currentUserService).requireRoleAtLeastEmployee();
        when(currentUserService.requireCurrentCompanyId()).thenReturn(1L);

        Company company = new Company();
        company.setId(1L);

        usuario = new Usuario();
        usuario.setId(5L);
        usuario.setUsername("alice");
        lenient().when(currentUserService.requireCurrentUsuario()).thenReturn(usuario);

        producto = new Producto();
        producto.setId(10L);
        producto.setCompany(company);
        producto.setCantidad(12);
        producto.setCodigo("P-TEST");
        producto.setNombre("Item");
        producto.setFechaCreacion(Instant.now());
        producto.setFechaActualizacion(Instant.now());
        producto.setActivo(true);

        when(productoRepository.findByIdAndCompany_Id(10L, 1L)).thenReturn(Optional.of(producto));
    }

    @Test
    void entrada_sumaStock_yGuardaMovimiento() {
        inventarioService.registrarMovimientoManual(10L, TipoMovimiento.ENTRADA, 3, "Compra");

        assertEquals(15, producto.getCantidad());
        verify(productoRepository).save(producto);
        verify(movimientoStockRepository).save(movCaptor.capture());
        MovimientoStock m = movCaptor.getValue();
        assertEquals(TipoMovimiento.ENTRADA, m.getTipo());
        assertEquals(3, m.getCantidad());
        assertEquals("Compra", m.getObservacion());
    }

    @Test
    void salida_restaStock() {
        inventarioService.registrarMovimientoManual(10L, TipoMovimiento.SALIDA, 4, null);

        assertEquals(8, producto.getCantidad());
        verify(movimientoStockRepository).save(movCaptor.capture());
        assertEquals(TipoMovimiento.SALIDA, movCaptor.getValue().getTipo());
        assertEquals(4, movCaptor.getValue().getCantidad());
    }

    @Test
    void salida_sinStock_badRequest() {
        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> inventarioService.registrarMovimientoManual(10L, TipoMovimiento.SALIDA, 20, null)
        );
        assertEquals(400, ex.getStatusCode().value());
        verify(movimientoStockRepository, never()).save(any());
    }

    @Test
    void ajuste_defineCantidadAbsoluta() {
        inventarioService.registrarMovimientoManual(10L, TipoMovimiento.AJUSTE, 7, "Inventario");

        assertEquals(7, producto.getCantidad());
        verify(movimientoStockRepository).save(movCaptor.capture());
        MovimientoStock m = movCaptor.getValue();
        assertEquals(TipoMovimiento.AJUSTE, m.getTipo());
        assertEquals(7, m.getCantidad());
    }
}

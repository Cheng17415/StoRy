package com.story;

import com.story.model.Company;
import com.story.model.CompanyCurrency;
import com.story.model.Producto;
import com.story.model.Usuario;
import com.story.repository.CategoriaRepository;
import com.story.repository.ProductoCarpetaRepository;
import com.story.repository.ProductoRepository;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CatalogoServiceClonarProductoTest {

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
    void clonarProducto_nuevoCodigoYNombreCopia() {
        Company company = new Company();
        company.setId(3L);
        company.setName("acme");
        company.setCurrency(CompanyCurrency.EUR);
        Usuario u = new Usuario();
        u.setId(7L);
        u.setUsername("worker");

        Producto origen = new Producto();
        origen.setId(100L);
        origen.setCompany(company);
        origen.setUsuario(u);
        origen.setNombre("Lápiz");
        origen.setDescripcion("desc");
        origen.setCantidad(4);
        origen.setPrecio(new BigDecimal("2.50"));
        origen.setCodigo("OLD-CODE");
        origen.setImagen("https://example.supabase.co/storage/v1/object/public/imagenes/old.png");
        origen.setActivo(true);
        origen.setFechaCreacion(Instant.now());
        origen.setFechaActualizacion(Instant.now());

        when(currentUserService.requireCurrentCompanyId()).thenReturn(3L);
        when(productoRepository.findByIdAndCompany_Id(100L, 3L)).thenReturn(Optional.of(origen));
        doNothing().when(currentUserService).requireRoleAtLeastEmployee();
        when(currentUserService.requireCurrentUsuario()).thenReturn(u);
        when(currentUserService.requireCurrentCompanyMember()).thenReturn(memberWithCompany(company));
        when(fileStorageService.duplicateOrPassthrough("https://example.supabase.co/storage/v1/object/public/imagenes/old.png"))
                .thenReturn("https://example.supabase.co/storage/v1/object/public/imagenes/new.png");
        when(productoRepository.existsByCompany_IdAndCodigo(eq(3L), any())).thenReturn(false);

        catalogoService.clonarProducto(100L);

        verify(productoRepository).save(productCaptor.capture());
        Producto saved = productCaptor.getValue();
        assertEquals("Lápiz (copia)", saved.getNombre());
        assertEquals(4, saved.getCantidad());
        assertEquals("https://example.supabase.co/storage/v1/object/public/imagenes/new.png", saved.getImagen());
        assertTrue(saved.getCodigo().startsWith("PRD-"));
        verify(inventarioService).registrarStockInicial(saved, 4);
    }

    private static com.story.model.CompanyMember memberWithCompany(Company company) {
        com.story.model.CompanyMember m = new com.story.model.CompanyMember();
        m.setCompany(company);
        return m;
    }
}

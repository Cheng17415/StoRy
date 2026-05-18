package com.story;

import com.story.model.Categoria;
import com.story.model.CategoriaResponse;
import com.story.model.Company;
import com.story.model.CompanyCurrency;
import com.story.model.CompanyMember;
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
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CatalogoServiceCategoriaTest {

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
    private ArgumentCaptor<Categoria> categoriaCaptor;
    @Captor
    private ArgumentCaptor<Producto> productoCaptor;

    @Test
    void crearCategoria_success() {
        Company company = buildCompany();
        CompanyMember member = new CompanyMember();
        member.setCompany(company);

        doNothing().when(currentUserService).requireRoleAtLeastEmployee();
        when(currentUserService.requireCurrentCompanyMember()).thenReturn(member);
        when(categoriaRepository.existsByCompany_IdAndNombreIgnoreCase(1L, "Alimentación")).thenReturn(false);
        when(categoriaRepository.save(any(Categoria.class))).thenAnswer(inv -> {
            Categoria c = inv.getArgument(0);
            c.setId(10L);
            return c;
        });

        CategoriaResponse result = catalogoService.crearCategoria("Alimentación", "Comida");

        verify(categoriaRepository).save(categoriaCaptor.capture());
        Categoria saved = categoriaCaptor.getValue();
        assertEquals("Alimentación", saved.getNombre());
        assertEquals("Comida", saved.getDescripcion());
        assertEquals(company, saved.getCompany());
        assertEquals(10L, result.id());
        assertEquals("Alimentación", result.nombre());
    }

    @Test
    void agregarProductoCategoria_byId_success() {
        Producto producto = buildProducto();
        Categoria categoria = buildCategoria(5L, "Alimentación");

        doNothing().when(currentUserService).requireRoleAtLeastEmployee();
        when(currentUserService.requireCurrentCompanyId()).thenReturn(1L);
        when(productoRepository.findByIdAndCompany_IdWithCategorias(1L, 1L)).thenReturn(Optional.of(producto));
        when(categoriaRepository.findByIdAndCompany_Id(5L, 1L)).thenReturn(Optional.of(categoria));

        catalogoService.agregarProductoCategoria(1L, 5L, null);

        verify(productoRepository).save(productoCaptor.capture());
        assertTrue(productoCaptor.getValue().getCategorias().contains(categoria));
    }

    @Test
    void agregarProductoCategoria_byNombre_createsAndAdds() {
        Producto producto = buildProducto();
        Company company = buildCompany();
        CompanyMember member = new CompanyMember();
        member.setCompany(company);

        doNothing().when(currentUserService).requireRoleAtLeastEmployee();
        when(currentUserService.requireCurrentCompanyId()).thenReturn(1L);
        when(currentUserService.requireCurrentCompanyMember()).thenReturn(member);
        when(productoRepository.findByIdAndCompany_IdWithCategorias(1L, 1L)).thenReturn(Optional.of(producto));
        when(categoriaRepository.findByCompany_IdAndNombreIgnoreCase(1L, "Bebida")).thenReturn(Optional.empty());
        when(categoriaRepository.save(any(Categoria.class))).thenAnswer(inv -> {
            Categoria c = inv.getArgument(0);
            c.setId(8L);
            return c;
        });

        var result = catalogoService.agregarProductoCategoria(1L, null, "Bebida");

        verify(productoRepository).save(productoCaptor.capture());
        assertEquals(1, productoCaptor.getValue().getCategorias().size());
        assertEquals(1, result.categorias().size());
        assertEquals("Bebida", result.categorias().get(0).nombre());
    }

    @Test
    void quitarProductoCategoria_success() {
        Producto producto = buildProducto();
        Categoria categoria = buildCategoria(5L, "Alimentación");
        producto.getCategorias().add(categoria);

        doNothing().when(currentUserService).requireRoleAtLeastEmployee();
        when(currentUserService.requireCurrentCompanyId()).thenReturn(1L);
        when(productoRepository.findByIdAndCompany_IdWithCategorias(1L, 1L)).thenReturn(Optional.of(producto));
        when(categoriaRepository.findByIdAndCompany_Id(5L, 1L)).thenReturn(Optional.of(categoria));

        catalogoService.quitarProductoCategoria(1L, 5L);

        verify(productoRepository).save(productoCaptor.capture());
        assertTrue(productoCaptor.getValue().getCategorias().isEmpty());
    }

    @Test
    void agregarProductoCategoria_unknownCategory_notFound() {
        Producto producto = buildProducto();

        doNothing().when(currentUserService).requireRoleAtLeastEmployee();
        when(currentUserService.requireCurrentCompanyId()).thenReturn(1L);
        when(productoRepository.findByIdAndCompany_IdWithCategorias(1L, 1L)).thenReturn(Optional.of(producto));
        when(categoriaRepository.findByIdAndCompany_Id(99L, 1L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> catalogoService.agregarProductoCategoria(1L, 99L, null)
        );

        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void listarProductos_withCategoriaId_delegatesToRepository() {
        Producto producto = buildProducto();
        Categoria categoria = buildCategoria(5L, "Alimentación");
        producto.getCategorias().add(categoria);

        when(currentUserService.requireCurrentCompanyId()).thenReturn(1L);
        when(categoriaRepository.findByIdAndCompany_Id(5L, 1L)).thenReturn(Optional.of(categoria));
        when(productoRepository.findByCompanyAndCarpetaAndCategoriaOptional(1L, null, 5L))
                .thenReturn(List.of(producto));

        var result = catalogoService.listarProductos(null, 5L);

        assertEquals(1, result.size());
        assertEquals(5L, result.get(0).categorias().get(0).id());
        verify(productoRepository).findByCompanyAndCarpetaAndCategoriaOptional(eq(1L), isNull(), eq(5L));
    }

    private Company buildCompany() {
        Company company = new Company();
        company.setId(1L);
        company.setName("acme");
        company.setCurrency(CompanyCurrency.EUR);
        return company;
    }

    private Producto buildProducto() {
        Company company = buildCompany();
        Usuario user = new Usuario();
        user.setId(99L);
        user.setUsername("tester");

        Producto p = new Producto();
        p.setId(1L);
        p.setCompany(company);
        p.setUsuario(user);
        p.setCodigo("P-1");
        p.setNombre("Producto");
        p.setFechaCreacion(Instant.now());
        p.setFechaActualizacion(Instant.now());
        p.setActivo(true);
        p.setCategorias(new HashSet<>());
        return p;
    }

    private Categoria buildCategoria(Long id, String nombre) {
        Categoria c = new Categoria();
        c.setId(id);
        c.setCompany(buildCompany());
        c.setNombre(nombre);
        return c;
    }
}

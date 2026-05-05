package com.story.service;

import com.story.model.CategoriaResponse;
import com.story.model.Company;
import com.story.model.CompanyRole;
import com.story.model.Producto;
import com.story.model.ProductoResponse;
import com.story.model.Usuario;
import com.story.repository.CategoriaRepository;
import com.story.repository.ProductoRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class CatalogoService {

    private final CategoriaRepository categoriaRepository;
    private final ProductoRepository productoRepository;
    private final FileStorageService fileStorageService;
    private final CurrentUserService currentUserService;
    private final InventarioService inventarioService;

    public CatalogoService(
            CategoriaRepository categoriaRepository,
            ProductoRepository productoRepository,
            FileStorageService fileStorageService,
            CurrentUserService currentUserService,
            InventarioService inventarioService
    ) {
        this.categoriaRepository = categoriaRepository;
        this.productoRepository = productoRepository;
        this.fileStorageService = fileStorageService;
        this.currentUserService = currentUserService;
        this.inventarioService = inventarioService;
    }

    @Transactional(readOnly = true)
    public List<CategoriaResponse> listarCategorias() {
        return categoriaRepository.findAll().stream()
                .map(c -> new CategoriaResponse(c.getId(), c.getNombre(), c.getDescripcion()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ProductoResponse> listarProductos() {
        Long companyId = currentUserService.requireCurrentCompanyId();
        return productoRepository.findAllByCompany_IdOrderByFechaActualizacionDesc(companyId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductoResponse obtenerProducto(Long id) {
        Long companyId = currentUserService.requireCurrentCompanyId();
        Producto p = productoRepository.findByIdAndCompany_Id(id, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
        return toResponse(p);
    }

    @Transactional
    public ProductoResponse crearProducto(
            String nombre,
            int cantidad,
            BigDecimal precio,
            String stockMinimoRaw,
            String descripcion,
            MultipartFile imagen
    ) {
        if (nombre == null || nombre.isBlank()) {
            throw new IllegalArgumentException("El nombre es obligatorio");
        }
        currentUserService.requireRoleAtLeastEmployee();
        Integer stockMinimo = parseStockMinimo(stockMinimoRaw);
        Usuario owner = currentUserService.requireCurrentUsuario();
        Company company = currentUserService.requireCurrentCompanyMember().getCompany();
        Producto p = new Producto();
        p.setUsuario(owner);
        p.setCompany(company);
        p.setNombre(nombre.trim());
        p.setDescripcion(normalizeDescripcion(descripcion));
        p.setCantidad(cantidad);
        p.setPrecio(precio);
        p.setStockMinimo(stockMinimo);
        p.setCodigo(generateUniqueCodigo(company.getId()));
        p.setImagen(fileStorageService.store(imagen));
        p.setActivo(true);
        Instant now = Instant.now();
        p.setFechaCreacion(now);
        p.setFechaActualizacion(now);
        productoRepository.save(p);
        inventarioService.registrarStockInicial(p, cantidad);
        return toResponse(p);
    }

    @Transactional
    public ProductoResponse actualizarProducto(
            Long id,
            String nombre,
            int cantidad,
            BigDecimal precio,
            String stockMinimoRaw,
            String descripcion,
            MultipartFile imagen
    ) {
        currentUserService.requireRoleAtLeastEmployee();
        CompanyRole role = currentUserService.requireCurrentCompanyRole();
        Long companyId = currentUserService.requireCurrentCompanyId();
        Producto p = productoRepository.findByIdAndCompany_Id(id, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
        if (nombre == null || nombre.isBlank()) {
            throw new IllegalArgumentException("El nombre es obligatorio");
        }
        int cantidadAnterior = p.getCantidad();
        Integer stockMinimo = parseStockMinimo(stockMinimoRaw);
        if (role == CompanyRole.employee) {
            p.setCantidad(cantidad);
        } else {
            p.setNombre(nombre.trim());
            p.setDescripcion(normalizeDescripcion(descripcion));
            p.setCantidad(cantidad);
            p.setPrecio(precio);
            p.setStockMinimo(stockMinimo);
            if (imagen != null && !imagen.isEmpty()) {
                fileStorageService.deleteIfStored(p.getImagen());
                p.setImagen(fileStorageService.store(imagen));
            }
        }
        p.setFechaActualizacion(Instant.now());
        productoRepository.save(p);
        inventarioService.registrarCambioStockPorEdicion(p, cantidadAnterior, cantidad);
        return toResponse(p);
    }

    @Transactional
    public void eliminarProducto(Long id) {
        if (currentUserService.requireCurrentCompanyRole() != CompanyRole.company_admin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo company_admin puede eliminar productos");
        }
        Long companyId = currentUserService.requireCurrentCompanyId();
        Producto p = productoRepository.findByIdAndCompany_Id(id, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
        fileStorageService.deleteIfStored(p.getImagen());
        productoRepository.delete(p);
    }

    /** Texto libre (notas); vacío o solo espacios se guarda como null. */
    private String normalizeDescripcion(String raw) {
        if (raw == null) {
            return null;
        }
        String t = raw.trim();
        return t.isEmpty() ? null : t;
    }

    private Integer parseStockMinimo(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            int v = Integer.parseInt(raw.trim());
            if (v < 0) {
                throw new IllegalArgumentException("El stock mínimo no puede ser negativo");
            }
            return v;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("El stock mínimo debe ser un número entero válido");
        }
    }

    private String generateUniqueCodigo(Long companyId) {
        for (int i = 0; i < 20; i++) {
            String c = "PRD-" + UUID.randomUUID();
            if (!productoRepository.existsByCompany_IdAndCodigo(companyId, c)) {
                return c;
            }
        }
        throw new IllegalStateException("No se pudo generar un código único");
    }

    private ProductoResponse toResponse(Producto p) {
        return new ProductoResponse(
                p.getId(),
                p.getNombre(),
                p.getDescripcion(),
                p.getCodigo(),
                p.getPrecio(),
                p.getCantidad(),
                p.getStockMinimo(),
                Boolean.TRUE.equals(p.getActivo()),
                p.getFechaCreacion(),
                p.getFechaActualizacion(),
                p.getImagen(),
                p.getCategoria() != null ? p.getCategoria().getId() : null,
                p.getCategoria() != null ? p.getCategoria().getNombre() : null
        );
    }
}

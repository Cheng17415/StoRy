package com.story.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.story.model.Categoria;
import com.story.model.CategoriaResponse;
import com.story.model.Company;
import com.story.model.CompanyRole;
import com.story.model.OpenFoodFactsProductResponse;
import com.story.model.Producto;
import com.story.model.ProductoCarpeta;
import com.story.model.ProductoResponse;
import com.story.model.Usuario;
import com.story.repository.CategoriaRepository;
import com.story.repository.ProductoCarpetaRepository;
import com.story.repository.ProductoRepository;
import com.story.security.CompanyAdminMessages;
import com.story.util.TextUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

@Service
public class CatalogoService {

    private final CategoriaRepository categoriaRepository;
    private final ProductoRepository productoRepository;
    private final ProductoCarpetaRepository productoCarpetaRepository;
    private final FileStorageService fileStorageService;
    private final CurrentUserService currentUserService;
    private final InventarioService inventarioService;
    private final OpenFoodFactsService openFoodFactsService;
    private final ObjectMapper objectMapper;

    public CatalogoService(
            CategoriaRepository categoriaRepository,
            ProductoRepository productoRepository,
            ProductoCarpetaRepository productoCarpetaRepository,
            FileStorageService fileStorageService,
            CurrentUserService currentUserService,
            InventarioService inventarioService,
            OpenFoodFactsService openFoodFactsService,
            ObjectMapper objectMapper
    ) {
        this.categoriaRepository = categoriaRepository;
        this.productoRepository = productoRepository;
        this.productoCarpetaRepository = productoCarpetaRepository;
        this.fileStorageService = fileStorageService;
        this.currentUserService = currentUserService;
        this.inventarioService = inventarioService;
        this.openFoodFactsService = openFoodFactsService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<CategoriaResponse> listarCategorias() {
        Long companyId = currentUserService.requireCurrentCompanyId();
        return categoriaRepository.findAllByCompany_IdOrderByNombreAsc(companyId).stream()
                .map(c -> new CategoriaResponse(c.getId(), c.getNombre(), c.getDescripcion()))
                .toList();
    }

    @Transactional
    public CategoriaResponse crearCategoria(String nombre, String descripcion) {
        currentUserService.requireRoleAtLeastEmployee();
        if (nombre == null || nombre.isBlank()) {
            throw new IllegalArgumentException("El nombre es obligatorio");
        }
        String trimmed = nombre.trim();
        Company company = currentUserService.requireCurrentCompanyMember().getCompany();
        Long companyId = company.getId();
        if (categoriaRepository.existsByCompany_IdAndNombreIgnoreCase(companyId, trimmed)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una categoría con ese nombre");
        }
        Categoria c = new Categoria();
        c.setCompany(company);
        c.setNombre(trimmed);
        c.setDescripcion(TextUtils.normalizeOptionalText(descripcion));
        categoriaRepository.save(c);
        return new CategoriaResponse(c.getId(), c.getNombre(), c.getDescripcion());
    }

    /**
     * Lista productos en la carpeta indicada; {@code carpetaId == null} es la raíz (sin carpeta).
     */
    @Transactional(readOnly = true)
    public List<ProductoResponse> listarProductos(Long carpetaId, Long categoriaId) {
        Long companyId = currentUserService.requireCurrentCompanyId();
        if (carpetaId != null) {
            productoCarpetaRepository.findByIdAndCompany_Id(carpetaId, companyId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carpeta no encontrada"));
        }
        if (categoriaId != null) {
            categoriaRepository.findByIdAndCompany_Id(categoriaId, companyId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoría no encontrada"));
        }
        return productoRepository.findByCompanyAndCarpetaAndCategoriaOptional(companyId, carpetaId, categoriaId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Todos los productos de la empresa (cualquier carpeta), para agregados en cliente.
     */
    @Transactional(readOnly = true)
    public List<ProductoResponse> listarTodosLosProductosDeLaEmpresa() {
        Long companyId = currentUserService.requireCurrentCompanyId();
        return productoRepository.findAllByCompany_IdWithCategorias(companyId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ProductoResponse> listarProductosBajoMinimo(Long categoriaId) {
        Long companyId = currentUserService.requireCurrentCompanyId();
        return productoRepository.findBajoStockMinimo(companyId, categoriaId).stream()
                .sorted(Comparator
                        .comparingInt((Producto p) -> p.getStockMinimo() - p.getCantidad())
                        .reversed()
                        .thenComparing(p -> p.getNombre(), String.CASE_INSENSITIVE_ORDER))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductoResponse obtenerProducto(Long id) {
        return toResponse(requireProductoWithCategorias(id));
    }

    @Transactional
    public ProductoResponse crearProducto(
            String nombre,
            int cantidad,
            BigDecimal precio,
            String stockMinimoRaw,
            String descripcion,
            MultipartFile imagen,
            String imagenUrl,
            String codigoBarrasRaw,
            String nutriScoreRaw,
            String alergenosJson,
            Long carpetaId
    ) {
        if (nombre == null || nombre.isBlank()) {
            throw new IllegalArgumentException("El nombre es obligatorio");
        }
        currentUserService.requireRoleAtLeastEmployee();
        Integer stockMinimo = parseStockMinimo(stockMinimoRaw);
        Usuario owner = currentUserService.requireCurrentUsuario();
        Company company = currentUserService.requireCurrentCompanyMember().getCompany();
        Long companyId = company.getId();
        Producto p = new Producto();
        p.setUsuario(owner);
        p.setCompany(company);
        p.setNombre(nombre.trim());
        p.setDescripcion(TextUtils.normalizeOptionalText(descripcion));
        p.setCantidad(cantidad);
        p.setPrecio(precio);
        p.setStockMinimo(stockMinimo);
        p.setCodigo(generateUniqueCodigo(companyId));
        String codigoBarras = normalizeCodigoBarras(codigoBarrasRaw);
        if (codigoBarrasRaw != null && !codigoBarrasRaw.isBlank() && codigoBarras == null) {
            throw new IllegalArgumentException("El código de barras debe contener entre 8 y 14 dígitos");
        }
        p.setCodigoBarras(codigoBarras);
        p.setNutriScore(OpenFoodFactsService.normalizeNutriScore(nutriScoreRaw));
        p.setAlergenos(parseAlergenosJson(alergenosJson));
        p.setImagen(resolveImagen(imagen, imagenUrl));
        p.setActivo(true);
        Instant now = Instant.now();
        p.setFechaCreacion(now);
        p.setFechaActualizacion(now);
        if (carpetaId != null) {
            ProductoCarpeta carpeta = productoCarpetaRepository.findByIdAndCompany_Id(carpetaId, companyId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carpeta no encontrada"));
            p.setCarpeta(carpeta);
        }
        productoRepository.save(p);
        inventarioService.registrarStockInicial(p, cantidad);
        return toResponse(p);
    }

    @Transactional
    public ProductoResponse registrarCodigoBarras(Long productoId, String codigoBarrasRaw) {
        currentUserService.requireRoleAtLeastEmployee();
        Producto p = requireProductoWithCategorias(productoId);
        if (p.getCodigoBarras() != null && !p.getCodigoBarras().isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El producto ya tiene código de barras");
        }
        String codigoBarras = normalizeCodigoBarras(codigoBarrasRaw);
        if (codigoBarras == null) {
            throw new IllegalArgumentException("El código de barras debe contener entre 8 y 14 dígitos");
        }
        OpenFoodFactsProductResponse off = openFoodFactsService.fetchProduct(codigoBarras)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Producto no encontrado en Open Food Facts"
                ));
        applyOpenFoodFactsData(p, off);
        p.setFechaActualizacion(Instant.now());
        productoRepository.save(p);
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
            MultipartFile imagen,
            String carpetaIdRaw
    ) {
        currentUserService.requireRoleAtLeastEmployee();
        CompanyRole role = currentUserService.requireCurrentCompanyRole();
        Long companyId = currentUserService.requireCurrentCompanyId();
        Producto p = requireProducto(id);
        if (nombre == null || nombre.isBlank()) {
            throw new IllegalArgumentException("El nombre es obligatorio");
        }
        int cantidadAnterior = p.getCantidad();
        Integer stockMinimo = parseStockMinimo(stockMinimoRaw);
        if (role == CompanyRole.employee) {
            p.setCantidad(cantidad);
        } else {
            p.setNombre(nombre.trim());
            p.setDescripcion(TextUtils.normalizeOptionalText(descripcion));
            p.setCantidad(cantidad);
            p.setPrecio(precio);
            p.setStockMinimo(stockMinimo);
            if (imagen != null && !imagen.isEmpty()) {
                fileStorageService.deleteIfStored(p.getImagen());
                p.setImagen(fileStorageService.store(imagen));
            }
            if (carpetaIdRaw != null) {
                p.setCarpeta(resolveCarpetaFromParam(companyId, carpetaIdRaw));
            }
        }
        p.setFechaActualizacion(Instant.now());
        productoRepository.save(p);
        inventarioService.registrarCambioStockPorEdicion(p, cantidadAnterior, cantidad);
        return toResponse(p);
    }

    @Transactional
    public ProductoResponse moverProductoCarpeta(Long productoId, Long carpetaId) {
        currentUserService.requireRoleAtLeastEmployee();
        Long companyId = currentUserService.requireCurrentCompanyId();
        Producto p = requireProducto(productoId);
        if (carpetaId == null) {
            p.setCarpeta(null);
        } else {
            ProductoCarpeta carpeta = productoCarpetaRepository.findByIdAndCompany_Id(carpetaId, companyId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carpeta no encontrada"));
            p.setCarpeta(carpeta);
        }
        p.setFechaActualizacion(Instant.now());
        productoRepository.save(p);
        return toResponse(p);
    }

    @Transactional
    public ProductoResponse actualizarStockMinimo(Long productoId, Integer stockMinimo) {
        currentUserService.requireCompanyAdmin(CompanyAdminMessages.UPDATE_STOCK_MINIMO);
        if (stockMinimo != null && stockMinimo < 0) {
            throw new IllegalArgumentException("El stock mínimo no puede ser negativo");
        }
        Producto p = requireProducto(productoId);
        p.setStockMinimo(stockMinimo);
        p.setFechaActualizacion(Instant.now());
        productoRepository.save(p);
        return toResponse(p);
    }

    @Transactional
    public ProductoResponse agregarProductoCategoria(Long productoId, Long categoriaId, String nombre) {
        currentUserService.requireRoleAtLeastEmployee();
        Long companyId = currentUserService.requireCurrentCompanyId();
        Producto p = requireProductoWithCategorias(productoId);

        Categoria categoria = resolveCategoriaParaAgregar(companyId, categoriaId, nombre);
        boolean yaAsignada = p.getCategorias().stream().anyMatch(c -> c.getId().equals(categoria.getId()));
        if (!yaAsignada) {
            p.getCategorias().add(categoria);
            p.setFechaActualizacion(Instant.now());
            productoRepository.save(p);
        }
        return toResponse(p);
    }

    @Transactional
    public ProductoResponse quitarProductoCategoria(Long productoId, Long categoriaId) {
        currentUserService.requireRoleAtLeastEmployee();
        Long companyId = currentUserService.requireCurrentCompanyId();
        Producto p = requireProductoWithCategorias(productoId);
        categoriaRepository.findByIdAndCompany_Id(categoriaId, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoría no encontrada"));
        if (p.getCategorias().removeIf(c -> c.getId().equals(categoriaId))) {
            p.setFechaActualizacion(Instant.now());
            productoRepository.save(p);
        }
        return toResponse(p);
    }

    private Categoria resolveCategoriaParaAgregar(Long companyId, Long categoriaId, String nombre) {
        if (categoriaId != null) {
            return categoriaRepository.findByIdAndCompany_Id(categoriaId, companyId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoría no encontrada"));
        }
        if (nombre == null || nombre.isBlank()) {
            throw new IllegalArgumentException("Indica categoriaId o nombre");
        }
        String trimmed = nombre.trim();
        return categoriaRepository.findByCompany_IdAndNombreIgnoreCase(companyId, trimmed)
                .orElseGet(() -> {
                    Categoria c = new Categoria();
                    c.setCompany(currentUserService.requireCurrentCompanyMember().getCompany());
                    c.setNombre(trimmed);
                    return categoriaRepository.save(c);
                });
    }

    @Transactional
    public ProductoResponse clonarProducto(Long productoId) {
        Producto origen = requireProducto(productoId);
        return clonarProductoEn(origen, origen.getCarpeta());
    }

    /**
     * Clona un producto ya cargado (misma empresa) dentro de la carpeta destino (o raíz si {@code carpetaDestino} es null).
     */
    @Transactional
    public ProductoResponse clonarProductoEn(Producto origen, ProductoCarpeta carpetaDestino) {
        currentUserService.requireRoleAtLeastEmployee();
        Company company = currentUserService.requireCurrentCompanyMember().getCompany();
        Long companyId = company.getId();
        if (!companyId.equals(origen.getCompany().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Producto no pertenece a la empresa actual");
        }
        if (carpetaDestino != null && !companyId.equals(carpetaDestino.getCompany().getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Carpeta inválida para esta empresa");
        }
        return persistClon(origen, carpetaDestino);
    }

    private ProductoResponse persistClon(Producto origen, ProductoCarpeta carpetaDestino) {
        Usuario owner = currentUserService.requireCurrentUsuario();
        Company company = origen.getCompany();
        Long companyId = company.getId();

        Producto p = new Producto();
        p.setUsuario(owner);
        p.setCompany(company);
        p.setNombre(origen.getNombre() + " (copia)");
        p.setDescripcion(origen.getDescripcion());
        p.setCantidad(origen.getCantidad());
        p.setPrecio(origen.getPrecio());
        p.setStockMinimo(origen.getStockMinimo());
        p.setCodigo(generateUniqueCodigo(companyId));
        p.setCodigoBarras(origen.getCodigoBarras());
        p.setNutriScore(origen.getNutriScore());
        p.setAlergenos(copyAlergenos(origen.getAlergenos()));
        p.setImagen(fileStorageService.duplicateOrPassthrough(origen.getImagen()));
        p.setCategorias(new HashSet<>(origen.getCategorias()));
        p.setCarpeta(carpetaDestino);
        p.setActivo(true);
        Instant now = Instant.now();
        p.setFechaCreacion(now);
        p.setFechaActualizacion(now);
        productoRepository.save(p);
        inventarioService.registrarStockInicial(p, p.getCantidad());
        return toResponse(p);
    }

    @Transactional
    public void eliminarProducto(Long id) {
        currentUserService.requireCompanyAdmin(CompanyAdminMessages.DELETE_PRODUCT);
        Producto p = requireProducto(id);
        fileStorageService.deleteIfStored(p.getImagen());
        productoRepository.delete(p);
    }

    /**
     * Elimina producto sin comprobar rol admin (uso interno al borrar carpetas en cascada).
     */
    @Transactional
    public void eliminarProductoSinChequeoAdmin(Producto p) {
        Long companyId = currentUserService.requireCurrentCompanyId();
        if (!companyId.equals(p.getCompany().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Producto no pertenece a la empresa actual");
        }
        fileStorageService.deleteIfStored(p.getImagen());
        productoRepository.delete(p);
    }

    private Producto requireProducto(Long id) {
        return productoRepository.findByIdAndCompany_Id(id, currentUserService.requireCurrentCompanyId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    }

    private Producto requireProductoWithCategorias(Long id) {
        return productoRepository.findByIdAndCompany_IdWithCategorias(id, currentUserService.requireCurrentCompanyId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    }

    private ProductoCarpeta resolveCarpetaFromParam(Long companyId, String raw) {
        if (raw.isBlank()) {
            return null;
        }
        try {
            long cid = Long.parseLong(raw.trim());
            return productoCarpetaRepository.findByIdAndCompany_Id(cid, companyId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carpeta no encontrada"));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("carpetaId inválido");
        }
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
        List<CategoriaResponse> categorias = p.getCategorias().stream()
                .sorted(Comparator.comparing(Categoria::getNombre, String.CASE_INSENSITIVE_ORDER))
                .map(c -> new CategoriaResponse(c.getId(), c.getNombre(), c.getDescripcion()))
                .toList();
        return new ProductoResponse(
                p.getId(),
                p.getNombre(),
                p.getDescripcion(),
                p.getCodigo(),
                p.getCodigoBarras(),
                p.getNutriScore(),
                copyAlergenos(p.getAlergenos()),
                p.getPrecio(),
                p.getCantidad(),
                p.getStockMinimo(),
                Boolean.TRUE.equals(p.getActivo()),
                p.getFechaCreacion(),
                p.getFechaActualizacion(),
                p.getImagen(),
                categorias,
                p.getCarpeta() != null ? p.getCarpeta().getId() : null,
                p.getCarpeta() != null ? p.getCarpeta().getNombre() : null
        );
    }

    private void applyOpenFoodFactsData(Producto p, OpenFoodFactsProductResponse off) {
        p.setCodigoBarras(off.codigoBarras());
        p.setNutriScore(off.nutriScore());
        p.setAlergenos(copyAlergenos(off.alergenos()));
        if (p.getImagen() == null || p.getImagen().isBlank()) {
            p.setImagen(off.imagenUrl());
        }
    }

    private String resolveImagen(MultipartFile imagen, String imagenUrl) {
        if (imagen != null && !imagen.isEmpty()) {
            return fileStorageService.store(imagen);
        }
        if (imagenUrl != null && !imagenUrl.isBlank()) {
            return imagenUrl.trim();
        }
        return null;
    }

    private String normalizeCodigoBarras(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return OpenFoodFactsService.normalizeBarcode(raw);
    }

    private List<String> parseAlergenosJson(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            List<String> tags = objectMapper.readValue(raw, new TypeReference<>() {});
            if (tags == null || tags.isEmpty()) {
                return null;
            }
            return List.copyOf(tags.stream()
                    .filter(tag -> tag != null && !tag.isBlank())
                    .map(String::trim)
                    .toList());
        } catch (Exception e) {
            throw new IllegalArgumentException("Formato de alérgenos inválido");
        }
    }

    private static List<String> copyAlergenos(List<String> source) {
        if (source == null || source.isEmpty()) {
            return List.of();
        }
        return List.copyOf(source);
    }
}

package com.story.service;

import com.story.model.CarpetaArbolResponse;
import com.story.model.CarpetaResponse;
import com.story.model.ClonarCarpetaResponse;
import com.story.model.Company;
import com.story.model.CompanyRole;
import com.story.model.Producto;
import com.story.model.ProductoCarpeta;
import com.story.repository.ProductoCarpetaRepository;
import com.story.repository.ProductoRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class CarpetaService {

    private final ProductoCarpetaRepository productoCarpetaRepository;
    private final ProductoRepository productoRepository;
    private final CatalogoService catalogoService;
    private final CurrentUserService currentUserService;

    public CarpetaService(
            ProductoCarpetaRepository productoCarpetaRepository,
            ProductoRepository productoRepository,
            CatalogoService catalogoService,
            CurrentUserService currentUserService
    ) {
        this.productoCarpetaRepository = productoCarpetaRepository;
        this.productoRepository = productoRepository;
        this.catalogoService = catalogoService;
        this.currentUserService = currentUserService;
    }

    @Transactional(readOnly = true)
    public List<CarpetaArbolResponse> listarArbol() {
        Long companyId = currentUserService.requireCurrentCompanyId();
        List<ProductoCarpeta> all = productoCarpetaRepository.findAllByCompany_IdOrderByNombreAsc(companyId);
        Map<Long, List<ProductoCarpeta>> byParent = new HashMap<>();
        for (ProductoCarpeta c : all) {
            Long pid = c.getParent() == null ? null : c.getParent().getId();
            byParent.computeIfAbsent(pid, k -> new ArrayList<>()).add(c);
        }
        byParent.values().forEach(list -> list.sort(Comparator.comparing(ProductoCarpeta::getNombre, String.CASE_INSENSITIVE_ORDER)));
        List<ProductoCarpeta> roots = byParent.getOrDefault(null, List.of());
        return roots.stream().map(r -> toArbol(r, byParent)).toList();
    }

    private CarpetaArbolResponse toArbol(ProductoCarpeta c, Map<Long, List<ProductoCarpeta>> byParent) {
        Long parentId = c.getParent() != null ? c.getParent().getId() : null;
        List<ProductoCarpeta> kids = byParent.getOrDefault(c.getId(), List.of());
        List<CarpetaArbolResponse> hijos = kids.stream().map(ch -> toArbol(ch, byParent)).toList();
        return new CarpetaArbolResponse(c.getId(), c.getNombre(), parentId, c.getDescripcion(), hijos);
    }

    @Transactional
    public CarpetaResponse crear(String nombre, Long parentId, String descripcionRaw) {
        currentUserService.requireRoleAtLeastEmployee();
        if (nombre == null || nombre.isBlank()) {
            throw new IllegalArgumentException("El nombre es obligatorio");
        }
        Long companyId = currentUserService.requireCurrentCompanyId();
        Company company = currentUserService.requireCurrentCompanyMember().getCompany();
        ProductoCarpeta c = new ProductoCarpeta();
        c.setCompany(company);
        if (parentId != null) {
            ProductoCarpeta parent = productoCarpetaRepository.findByIdAndCompany_Id(parentId, companyId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carpeta padre no encontrada"));
            c.setParent(parent);
        }
        c.setNombre(nombre.trim());
        c.setDescripcion(normalizeDescripcion(descripcionRaw));
        Instant now = Instant.now();
        c.setFechaCreacion(now);
        c.setFechaActualizacion(now);
        productoCarpetaRepository.save(c);
        return toResponse(c);
    }

    private static String normalizeDescripcion(String raw) {
        if (raw == null) {
            return null;
        }
        String t = raw.trim();
        return t.isEmpty() ? null : t;
    }

    @Transactional
    public CarpetaResponse renombrar(Long id, String nombre) {
        currentUserService.requireRoleAtLeastEmployee();
        if (nombre == null || nombre.isBlank()) {
            throw new IllegalArgumentException("El nombre es obligatorio");
        }
        Long companyId = currentUserService.requireCurrentCompanyId();
        ProductoCarpeta c = productoCarpetaRepository.findByIdAndCompany_Id(id, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carpeta no encontrada"));
        c.setNombre(nombre.trim());
        c.setFechaActualizacion(Instant.now());
        productoCarpetaRepository.save(c);
        return toResponse(c);
    }

    @Transactional
    public CarpetaResponse mover(Long id, Long newParentId) {
        currentUserService.requireRoleAtLeastEmployee();
        Long companyId = currentUserService.requireCurrentCompanyId();
        ProductoCarpeta c = productoCarpetaRepository.findByIdAndCompany_Id(id, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carpeta no encontrada"));
        Set<Long> subtree = collectSubtreeIds(companyId, id);
        if (newParentId != null) {
            if (subtree.contains(newParentId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No se puede mover una carpeta dentro de sí misma");
            }
            ProductoCarpeta parent = productoCarpetaRepository.findByIdAndCompany_Id(newParentId, companyId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carpeta padre no encontrada"));
            c.setParent(parent);
        } else {
            c.setParent(null);
        }
        c.setFechaActualizacion(Instant.now());
        productoCarpetaRepository.save(c);
        return toResponse(c);
    }

    @Transactional
    public void eliminar(Long id) {
        if (currentUserService.requireCurrentCompanyRole() != CompanyRole.company_admin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo company_admin puede eliminar carpetas");
        }
        Long companyId = currentUserService.requireCurrentCompanyId();
        ProductoCarpeta carpeta = productoCarpetaRepository.findByIdAndCompany_Id(id, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carpeta no encontrada"));
        Set<Long> subtree = collectSubtreeIds(companyId, id);
        List<Producto> productos = productoRepository.findAllByCompany_IdAndCarpeta_IdIn(companyId, subtree);
        for (Producto p : productos) {
            catalogoService.eliminarProductoSinChequeoAdmin(p);
        }
        productoCarpetaRepository.delete(carpeta);
    }

    @Transactional
    public ClonarCarpetaResponse clonar(Long id, Long parentIdDestinoExplicito) {
        currentUserService.requireRoleAtLeastEmployee();
        Long companyId = currentUserService.requireCurrentCompanyId();
        ProductoCarpeta origen = productoCarpetaRepository.findByIdAndCompany_Id(id, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carpeta no encontrada"));
        ProductoCarpeta parentDest;
        if (parentIdDestinoExplicito != null) {
            parentDest = productoCarpetaRepository.findByIdAndCompany_Id(parentIdDestinoExplicito, companyId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carpeta destino no encontrada"));
        } else {
            parentDest = origen.getParent();
        }
        int[] folders = {0};
        int[] products = {0};
        ProductoCarpeta nuevaRaiz = cloneRecursive(origen, parentDest, folders, products);
        return new ClonarCarpetaResponse(nuevaRaiz.getId(), folders[0], products[0]);
    }

    private ProductoCarpeta cloneRecursive(
            ProductoCarpeta origen,
            ProductoCarpeta nuevoPadre,
            int[] folders,
            int[] products
    ) {
        ProductoCarpeta nueva = new ProductoCarpeta();
        nueva.setCompany(origen.getCompany());
        nueva.setParent(nuevoPadre);
        nueva.setNombre(origen.getNombre());
        nueva.setDescripcion(origen.getDescripcion());
        Instant now = Instant.now();
        nueva.setFechaCreacion(now);
        nueva.setFechaActualizacion(now);
        productoCarpetaRepository.save(nueva);
        folders[0]++;
        Long companyId = origen.getCompany().getId();
        List<Producto> ps = productoRepository.findAllByCompany_IdAndCarpeta_IdOrderByFechaActualizacionDesc(companyId, origen.getId());
        for (Producto p : ps) {
            catalogoService.clonarProductoEn(p, nueva);
            products[0]++;
        }
        List<ProductoCarpeta> hijos = productoCarpetaRepository.findAllByCompany_IdAndParent_IdOrderByNombreAsc(companyId, origen.getId());
        for (ProductoCarpeta hijo : hijos) {
            cloneRecursive(hijo, nueva, folders, products);
        }
        return nueva;
    }

    private Set<Long> collectSubtreeIds(Long companyId, Long rootId) {
        Set<Long> result = new LinkedHashSet<>();
        Deque<Long> dq = new ArrayDeque<>();
        dq.add(rootId);
        while (!dq.isEmpty()) {
            Long nid = dq.poll();
            if (!result.add(nid)) {
                continue;
            }
            for (ProductoCarpeta ch : productoCarpetaRepository.findAllByCompany_IdAndParent_IdOrderByNombreAsc(companyId, nid)) {
                dq.add(ch.getId());
            }
        }
        return result;
    }

    private CarpetaResponse toResponse(ProductoCarpeta c) {
        Long parentId = c.getParent() != null ? c.getParent().getId() : null;
        return new CarpetaResponse(c.getId(), c.getNombre(), parentId, c.getDescripcion());
    }
}
